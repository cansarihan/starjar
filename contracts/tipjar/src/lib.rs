//! StarJar tip jar.
//!
//! A creator claims a handle once and gets a public jar. Anyone can tip the jar
//! in a token the admin has allowed, with a short message. The tip moves
//! straight from the tipper to the creator in the same call: the contract never
//! holds funds, so there is nothing to withdraw and nothing to drain.
//!
//! Network fees are not this contract's concern. The app wraps the tipper's
//! signed transaction in a fee bump, so the tipper's address is still the one
//! that authorises the transfer here.
#![no_std]

use soroban_sdk::{
    contract, contracterror, contractevent, contractimpl, contracttype, token, Address, BytesN,
    Env, String, Vec,
};

#[cfg(test)]
mod test;

/// Recent tips kept per jar, oldest dropped first.
pub const RECENT_LIMIT: u32 = 20;
pub const HANDLE_MIN: u32 = 3;
pub const HANDLE_MAX: u32 = 24;
pub const NAME_MAX: u32 = 48;
pub const BIO_MAX: u32 = 160;
pub const MESSAGE_MAX: u32 = 140;

/// About 30 days at 5s ledgers. Entries are bumped back to this on every write.
const TTL_EXTEND_TO: u32 = 518_400;
const TTL_THRESHOLD: u32 = TTL_EXTEND_TO - 17_280;

#[contracterror]
#[derive(Copy, Clone, Debug, Eq, PartialEq, PartialOrd, Ord)]
#[repr(u32)]
pub enum Error {
    Paused = 1,
    HandleInvalid = 2,
    HandleTaken = 3,
    AlreadyRegistered = 4,
    NotRegistered = 5,
    UnknownCreator = 6,
    TokenNotAllowed = 7,
    AmountInvalid = 8,
    MessageTooLong = 9,
    NameInvalid = 10,
    BioTooLong = 11,
    SelfTip = 12,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Profile {
    pub owner: Address,
    pub handle: String,
    pub name: String,
    pub bio: String,
    pub joined_ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Eq, PartialEq)]
pub struct Tip {
    pub id: u64,
    pub from: Address,
    pub token: Address,
    pub amount: i128,
    pub message: String,
    pub ledger: u32,
}

#[contracttype]
#[derive(Clone, Debug, Default, Eq, PartialEq)]
pub struct Stats {
    pub creators: u32,
    pub tips: u64,
    pub tippers: u32,
}

#[contracttype]
#[derive(Clone)]
enum Key {
    Admin,
    Paused,
    Stats,
    Token(Address),
    Creator(String),
    HandleOf(Address),
    Total(String, Address),
    Recent(String),
    TipsBy(Address),
}

#[contractevent(topics = ["registered"])]
pub struct Registered {
    #[topic]
    pub handle: String,
    pub owner: Address,
}

#[contractevent(topics = ["tipped"])]
pub struct Tipped {
    #[topic]
    pub handle: String,
    #[topic]
    pub from: Address,
    pub id: u64,
    pub token: Address,
    pub amount: i128,
    pub message: String,
}

#[contract]
pub struct TipJar;

#[contractimpl]
impl TipJar {
    /// Runs once, in the deploy transaction, so there is no window in which
    /// someone else can initialise the contract first.
    pub fn __constructor(env: Env, admin: Address, tokens: Vec<Address>) {
        env.storage().instance().set(&Key::Admin, &admin);
        env.storage().instance().set(&Key::Paused, &false);
        env.storage().instance().set(&Key::Stats, &Stats::default());
        for t in tokens.iter() {
            env.storage().instance().set(&Key::Token(t), &true);
        }
    }

    // ---- creators -------------------------------------------------------

    /// Claim a handle. One handle per address, one address per handle.
    pub fn register(
        env: Env,
        owner: Address,
        handle: String,
        name: String,
        bio: String,
    ) -> Result<Profile, Error> {
        owner.require_auth();
        not_paused(&env)?;
        check_handle(&handle)?;
        check_profile_text(&name, &bio)?;

        let store = env.storage().persistent();
        if store.has(&Key::HandleOf(owner.clone())) {
            return Err(Error::AlreadyRegistered);
        }
        if store.has(&Key::Creator(handle.clone())) {
            return Err(Error::HandleTaken);
        }

        let profile = Profile {
            owner: owner.clone(),
            handle: handle.clone(),
            name,
            bio,
            joined_ledger: env.ledger().sequence(),
        };
        put(&env, &Key::Creator(handle.clone()), &profile);
        put(&env, &Key::HandleOf(owner.clone()), &handle);

        let mut stats = stats(&env);
        stats.creators += 1;
        set_stats(&env, &stats);

        Registered { handle, owner }.publish(&env);
        Ok(profile)
    }

    /// Change the display name and bio. The handle never changes, because
    /// links to the jar would break.
    pub fn update_profile(env: Env, owner: Address, name: String, bio: String) -> Result<Profile, Error> {
        owner.require_auth();
        check_profile_text(&name, &bio)?;
        let handle: String = get(&env, &Key::HandleOf(owner)).ok_or(Error::NotRegistered)?;
        let mut profile: Profile = get(&env, &Key::Creator(handle.clone())).ok_or(Error::NotRegistered)?;
        profile.name = name;
        profile.bio = bio;
        put(&env, &Key::Creator(handle), &profile);
        Ok(profile)
    }

    // ---- tipping --------------------------------------------------------

    /// Send `amount` of `token` from `from` to the creator behind `handle`.
    /// Returns the global tip id.
    pub fn tip(
        env: Env,
        from: Address,
        handle: String,
        token: Address,
        amount: i128,
        message: String,
    ) -> Result<u64, Error> {
        from.require_auth();
        not_paused(&env)?;
        if amount <= 0 {
            return Err(Error::AmountInvalid);
        }
        if message.len() > MESSAGE_MAX {
            return Err(Error::MessageTooLong);
        }
        if !Self::is_token_allowed(env.clone(), token.clone()) {
            return Err(Error::TokenNotAllowed);
        }
        let profile: Profile = get(&env, &Key::Creator(handle.clone())).ok_or(Error::UnknownCreator)?;
        if profile.owner == from {
            return Err(Error::SelfTip);
        }

        // Book-keeping first, transfer last. A failed transfer reverts all of it.
        let mut stats = stats(&env);
        stats.tips += 1;
        let id = stats.tips;

        let by_key = Key::TipsBy(from.clone());
        let by: u32 = get(&env, &by_key).unwrap_or(0);
        if by == 0 {
            stats.tippers += 1;
        }
        put(&env, &by_key, &(by + 1));
        set_stats(&env, &stats);

        let total_key = Key::Total(handle.clone(), token.clone());
        let total: i128 = get(&env, &total_key).unwrap_or(0);
        put(&env, &total_key, &total.checked_add(amount).ok_or(Error::AmountInvalid)?);

        let recent_key = Key::Recent(handle.clone());
        let mut recent: Vec<Tip> = get(&env, &recent_key).unwrap_or_else(|| Vec::new(&env));
        if recent.len() >= RECENT_LIMIT {
            recent.pop_front();
        }
        recent.push_back(Tip {
            id,
            from: from.clone(),
            token: token.clone(),
            amount,
            message: message.clone(),
            ledger: env.ledger().sequence(),
        });
        put(&env, &recent_key, &recent);

        token::TokenClient::new(&env, &token).transfer(&from, &profile.owner, &amount);

        Tipped { handle, from, id, token, amount, message }.publish(&env);
        Ok(id)
    }

    // ---- reads ----------------------------------------------------------

    pub fn creator(env: Env, handle: String) -> Option<Profile> {
        get(&env, &Key::Creator(handle))
    }

    pub fn handle_of(env: Env, owner: Address) -> Option<String> {
        get(&env, &Key::HandleOf(owner))
    }

    pub fn total(env: Env, handle: String, token: Address) -> i128 {
        get(&env, &Key::Total(handle, token)).unwrap_or(0)
    }

    /// Newest last.
    pub fn recent(env: Env, handle: String) -> Vec<Tip> {
        get(&env, &Key::Recent(handle)).unwrap_or_else(|| Vec::new(&env))
    }

    pub fn tips_by(env: Env, from: Address) -> u32 {
        get(&env, &Key::TipsBy(from)).unwrap_or(0)
    }

    pub fn stats(env: Env) -> Stats {
        stats(&env)
    }

    pub fn is_token_allowed(env: Env, token: Address) -> bool {
        env.storage().instance().get(&Key::Token(token)).unwrap_or(false)
    }

    pub fn paused(env: Env) -> bool {
        env.storage().instance().get(&Key::Paused).unwrap_or(false)
    }

    pub fn admin(env: Env) -> Address {
        admin(&env)
    }

    // ---- admin ----------------------------------------------------------

    pub fn set_token(env: Env, token: Address, allowed: bool) {
        admin(&env).require_auth();
        if allowed {
            env.storage().instance().set(&Key::Token(token), &true);
        } else {
            env.storage().instance().remove(&Key::Token(token));
        }
        bump_instance(&env);
    }

    /// Stops new registrations and tips. Reads and profile edits keep working.
    pub fn set_paused(env: Env, paused: bool) {
        admin(&env).require_auth();
        env.storage().instance().set(&Key::Paused, &paused);
        bump_instance(&env);
    }

    /// Both the current and the next admin sign, so the role cannot be handed
    /// to an address nobody controls.
    pub fn set_admin(env: Env, new_admin: Address) {
        admin(&env).require_auth();
        new_admin.require_auth();
        env.storage().instance().set(&Key::Admin, &new_admin);
        bump_instance(&env);
    }

    pub fn upgrade(env: Env, wasm_hash: BytesN<32>) {
        admin(&env).require_auth();
        env.deployer().update_current_contract_wasm(wasm_hash);
    }
}

// ---- helpers ------------------------------------------------------------

fn admin(env: &Env) -> Address {
    env.storage().instance().get(&Key::Admin).expect("constructed with an admin")
}

fn not_paused(env: &Env) -> Result<(), Error> {
    if env.storage().instance().get(&Key::Paused).unwrap_or(false) {
        Err(Error::Paused)
    } else {
        Ok(())
    }
}

fn stats(env: &Env) -> Stats {
    env.storage().instance().get(&Key::Stats).unwrap_or_default()
}

fn set_stats(env: &Env, stats: &Stats) {
    env.storage().instance().set(&Key::Stats, stats);
    bump_instance(env);
}

fn bump_instance(env: &Env) {
    env.storage().instance().extend_ttl(TTL_THRESHOLD, TTL_EXTEND_TO);
}

fn get<V: soroban_sdk::TryFromVal<Env, soroban_sdk::Val>>(env: &Env, key: &Key) -> Option<V> {
    let store = env.storage().persistent();
    let value = store.get(key);
    if value.is_some() {
        store.extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
    }
    value
}

fn put<V: soroban_sdk::IntoVal<Env, soroban_sdk::Val>>(env: &Env, key: &Key, value: &V) {
    let store = env.storage().persistent();
    store.set(key, value);
    store.extend_ttl(key, TTL_THRESHOLD, TTL_EXTEND_TO);
}

/// Lowercase letters, digits and underscore; 3 to 24 bytes. Keeps handles
/// URL-safe and stops look-alike names built from mixed case.
fn check_handle(handle: &String) -> Result<(), Error> {
    let len = handle.len();
    if !(HANDLE_MIN..=HANDLE_MAX).contains(&len) {
        return Err(Error::HandleInvalid);
    }
    let mut buf = [0u8; HANDLE_MAX as usize];
    let bytes = &mut buf[..len as usize];
    handle.copy_into_slice(bytes);
    if bytes.iter().all(|b| b.is_ascii_lowercase() || b.is_ascii_digit() || *b == b'_') {
        Ok(())
    } else {
        Err(Error::HandleInvalid)
    }
}

fn check_profile_text(name: &String, bio: &String) -> Result<(), Error> {
    if name.len() == 0 || name.len() > NAME_MAX {
        return Err(Error::NameInvalid);
    }
    if bio.len() > BIO_MAX {
        return Err(Error::BioTooLong);
    }
    Ok(())
}
