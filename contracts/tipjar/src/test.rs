#![cfg(test)]
extern crate std;

use super::*;
use soroban_sdk::{
    testutils::{Address as _, AuthorizedFunction, Ledger},
    token::{StellarAssetClient, TokenClient},
    vec, Address, Env, IntoVal, String, Symbol,
};

struct Setup<'a> {
    env: Env,
    jar: TipJarClient<'a>,
    admin: Address,
    xlm: Address,
    usdc: Address,
}

fn setup<'a>() -> Setup<'a> {
    let env = Env::default();
    env.mock_all_auths();
    env.ledger().set_sequence_number(100);

    let admin = Address::generate(&env);
    let issuer = Address::generate(&env);
    let xlm = env.register_stellar_asset_contract_v2(issuer.clone()).address();
    let usdc = env.register_stellar_asset_contract_v2(issuer).address();

    let id = env.register(TipJar, (admin.clone(), vec![&env, xlm.clone(), usdc.clone()]));
    let jar = TipJarClient::new(&env, &id);
    Setup { env, jar, admin, xlm, usdc }
}

fn s(env: &Env, v: &str) -> String {
    String::from_str(env, v)
}

fn funded(t: &Setup, token: &Address, amount: i128) -> Address {
    let who = Address::generate(&t.env);
    StellarAssetClient::new(&t.env, token).mint(&who, &amount);
    who
}

fn creator(t: &Setup, handle: &str) -> Address {
    let owner = Address::generate(&t.env);
    t.jar.register(&owner, &s(&t.env, handle), &s(&t.env, "Ada"), &s(&t.env, "I draw maps"));
    owner
}

#[test]
fn constructor_sets_admin_and_tokens() {
    let t = setup();
    assert_eq!(t.jar.admin(), t.admin);
    assert!(t.jar.is_token_allowed(&t.xlm));
    assert!(t.jar.is_token_allowed(&t.usdc));
    assert!(!t.jar.is_token_allowed(&Address::generate(&t.env)));
    assert!(!t.jar.paused());
    assert_eq!(t.jar.stats(), Stats::default());
}

#[test]
fn register_stores_profile_and_reverse_lookup() {
    let t = setup();
    let owner = creator(&t, "ada_maps");

    let p = t.jar.creator(&s(&t.env, "ada_maps")).unwrap();
    assert_eq!(p.owner, owner);
    assert_eq!(p.name, s(&t.env, "Ada"));
    assert_eq!(p.joined_ledger, 100);
    assert_eq!(t.jar.handle_of(&owner), Some(s(&t.env, "ada_maps")));
    assert_eq!(t.jar.stats().creators, 1);
}

#[test]
fn register_requires_owner_auth() {
    let t = setup();
    let owner = creator(&t, "ada");
    let auths = t.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, owner);
    match &auths[0].1.function {
        AuthorizedFunction::Contract((_, name, _)) => assert_eq!(name, &Symbol::new(&t.env, "register")),
        _ => panic!("expected a contract call"),
    }
}

#[test]
fn handle_rules() {
    let t = setup();
    let owner = Address::generate(&t.env);
    let name = s(&t.env, "n");
    let bio = s(&t.env, "");
    for bad in ["ab", "Ada", "ada-maps", "ada maps", "çiçek", "abcdefghijklmnopqrstuvwxy"] {
        assert_eq!(
            t.jar.try_register(&owner, &s(&t.env, bad), &name, &bio),
            Err(Ok(Error::HandleInvalid)),
            "{bad}"
        );
    }
    for good in ["abc", "ada_2", "abcdefghijklmnopqrstuvwx"] {
        let o = Address::generate(&t.env);
        assert!(t.jar.try_register(&o, &s(&t.env, good), &name, &bio).is_ok(), "{good}");
    }
}

#[test]
fn one_handle_per_address_and_per_name() {
    let t = setup();
    let owner = creator(&t, "ada");
    let n = s(&t.env, "n");
    let b = s(&t.env, "");
    assert_eq!(t.jar.try_register(&owner, &s(&t.env, "ada2"), &n, &b), Err(Ok(Error::AlreadyRegistered)));
    let other = Address::generate(&t.env);
    assert_eq!(t.jar.try_register(&other, &s(&t.env, "ada"), &n, &b), Err(Ok(Error::HandleTaken)));
}

#[test]
fn profile_text_limits() {
    let t = setup();
    let o = Address::generate(&t.env);
    let h = s(&t.env, "ada");
    assert_eq!(t.jar.try_register(&o, &h, &s(&t.env, ""), &s(&t.env, "")), Err(Ok(Error::NameInvalid)));
    let long_bio = s(&t.env, &"x".repeat(161));
    assert_eq!(t.jar.try_register(&o, &h, &s(&t.env, "Ada"), &long_bio), Err(Ok(Error::BioTooLong)));
}

#[test]
fn update_profile_keeps_handle() {
    let t = setup();
    let owner = creator(&t, "ada");
    let p = t.jar.update_profile(&owner, &s(&t.env, "Ada L."), &s(&t.env, "new bio"));
    assert_eq!(p.handle, s(&t.env, "ada"));
    assert_eq!(t.jar.creator(&s(&t.env, "ada")).unwrap().name, s(&t.env, "Ada L."));

    let stranger = Address::generate(&t.env);
    assert_eq!(
        t.jar.try_update_profile(&stranger, &s(&t.env, "x"), &s(&t.env, "")),
        Err(Ok(Error::NotRegistered))
    );
}

#[test]
fn tip_moves_funds_directly_to_creator() {
    let t = setup();
    let owner = creator(&t, "ada");
    let fan = funded(&t, &t.xlm, 100_0000000);

    let id = t.jar.tip(&fan, &s(&t.env, "ada"), &t.xlm, &5_0000000, &s(&t.env, "love the maps"));
    assert_eq!(id, 1);

    let xlm = TokenClient::new(&t.env, &t.xlm);
    assert_eq!(xlm.balance(&fan), 95_0000000);
    assert_eq!(xlm.balance(&owner), 5_0000000);
    assert_eq!(xlm.balance(&t.jar.address), 0, "the contract never holds funds");

    assert_eq!(t.jar.total(&s(&t.env, "ada"), &t.xlm), 5_0000000);
    assert_eq!(t.jar.total(&s(&t.env, "ada"), &t.usdc), 0);
    assert_eq!(t.jar.tips_by(&fan), 1);

    let recent = t.jar.recent(&s(&t.env, "ada"));
    assert_eq!(recent.len(), 1);
    let tip = recent.get(0).unwrap();
    assert_eq!(tip.from, fan);
    assert_eq!(tip.amount, 5_0000000);
    assert_eq!(tip.message, s(&t.env, "love the maps"));
}

#[test]
fn tip_requires_tipper_auth_for_the_transfer() {
    let t = setup();
    creator(&t, "ada");
    let fan = funded(&t, &t.xlm, 10);
    t.jar.tip(&fan, &s(&t.env, "ada"), &t.xlm, &3, &s(&t.env, ""));

    let auths = t.env.auths();
    assert_eq!(auths.len(), 1);
    assert_eq!(auths[0].0, fan);
    let call = &auths[0].1;
    match &call.function {
        AuthorizedFunction::Contract((_, name, args)) => {
            assert_eq!(name, &Symbol::new(&t.env, "tip"));
            assert_eq!(args.len(), 5);
        }
        _ => panic!("expected a contract call"),
    }
    // The token transfer is authorised as a sub-invocation of the same signature.
    assert_eq!(call.sub_invocations.len(), 1);
}

#[test]
fn tip_without_auth_is_rejected() {
    let t = setup();
    creator(&t, "ada");
    let fan = funded(&t, &t.xlm, 10);
    t.env.set_auths(&[]);
    assert!(t.jar.try_tip(&fan, &s(&t.env, "ada"), &t.xlm, &3, &s(&t.env, "")).is_err());
}

#[test]
fn tip_validation() {
    let t = setup();
    let owner = creator(&t, "ada");
    let fan = funded(&t, &t.xlm, 100);
    let h = s(&t.env, "ada");
    let m = s(&t.env, "");

    assert_eq!(t.jar.try_tip(&fan, &h, &t.xlm, &0, &m), Err(Ok(Error::AmountInvalid)));
    assert_eq!(t.jar.try_tip(&fan, &h, &t.xlm, &-5, &m), Err(Ok(Error::AmountInvalid)));
    assert_eq!(
        t.jar.try_tip(&fan, &h, &t.xlm, &1, &s(&t.env, &"x".repeat(141))),
        Err(Ok(Error::MessageTooLong))
    );
    let rogue = t.env.register_stellar_asset_contract_v2(Address::generate(&t.env)).address();
    assert_eq!(t.jar.try_tip(&fan, &h, &rogue, &1, &m), Err(Ok(Error::TokenNotAllowed)));
    assert_eq!(t.jar.try_tip(&fan, &s(&t.env, "nobody"), &t.xlm, &1, &m), Err(Ok(Error::UnknownCreator)));

    StellarAssetClient::new(&t.env, &t.xlm).mint(&owner, &10);
    assert_eq!(t.jar.try_tip(&owner, &h, &t.xlm, &1, &m), Err(Ok(Error::SelfTip)));

    // Nothing was booked by the failed attempts.
    assert_eq!(t.jar.stats().tips, 0);
    assert_eq!(t.jar.recent(&h).len(), 0);
}

#[test]
fn tip_larger_than_balance_reverts_everything() {
    let t = setup();
    creator(&t, "ada");
    let fan = funded(&t, &t.xlm, 5);
    assert!(t.jar.try_tip(&fan, &s(&t.env, "ada"), &t.xlm, &6, &s(&t.env, "")).is_err());
    assert_eq!(t.jar.stats().tips, 0);
    assert_eq!(t.jar.tips_by(&fan), 0);
    assert_eq!(t.jar.total(&s(&t.env, "ada"), &t.xlm), 0);
}

#[test]
fn stats_count_unique_tippers() {
    let t = setup();
    creator(&t, "ada");
    creator(&t, "bob");
    let a = funded(&t, &t.usdc, 100);
    let b = funded(&t, &t.usdc, 100);
    let m = s(&t.env, "");
    t.jar.tip(&a, &s(&t.env, "ada"), &t.usdc, &1, &m);
    t.jar.tip(&a, &s(&t.env, "bob"), &t.usdc, &1, &m);
    t.jar.tip(&b, &s(&t.env, "ada"), &t.usdc, &1, &m);

    assert_eq!(t.jar.stats(), Stats { creators: 2, tips: 3, tippers: 2 });
    assert_eq!(t.jar.tips_by(&a), 2);
    assert_eq!(t.jar.total(&s(&t.env, "ada"), &t.usdc), 2);
}

#[test]
fn recent_keeps_the_last_twenty() {
    let t = setup();
    creator(&t, "ada");
    let fan = funded(&t, &t.xlm, 1_000);
    for _ in 0..25 {
        t.jar.tip(&fan, &s(&t.env, "ada"), &t.xlm, &1, &s(&t.env, "hi"));
    }
    let recent = t.jar.recent(&s(&t.env, "ada"));
    assert_eq!(recent.len(), RECENT_LIMIT);
    assert_eq!(recent.get(0).unwrap().id, 6);
    assert_eq!(recent.last().unwrap().id, 25);
    assert_eq!(t.jar.total(&s(&t.env, "ada"), &t.xlm), 25);
}

#[test]
fn pause_blocks_writes_but_not_reads() {
    let t = setup();
    let owner = creator(&t, "ada");
    let fan = funded(&t, &t.xlm, 10);
    t.jar.set_paused(&true);
    assert!(t.jar.paused());

    let m = s(&t.env, "");
    assert_eq!(t.jar.try_tip(&fan, &s(&t.env, "ada"), &t.xlm, &1, &m), Err(Ok(Error::Paused)));
    let o = Address::generate(&t.env);
    assert_eq!(t.jar.try_register(&o, &s(&t.env, "bob"), &s(&t.env, "B"), &m), Err(Ok(Error::Paused)));
    assert!(t.jar.creator(&s(&t.env, "ada")).is_some());
    assert!(t.jar.try_update_profile(&owner, &s(&t.env, "A"), &m).is_ok());

    t.jar.set_paused(&false);
    assert!(t.jar.try_tip(&fan, &s(&t.env, "ada"), &t.xlm, &1, &m).is_ok());
}

#[test]
fn admin_calls_require_admin_auth() {
    let t = setup();
    let token = Address::generate(&t.env);
    t.jar.set_token(&token, &true);
    assert_eq!(
        t.env.auths()[0],
        (
            t.admin.clone(),
            soroban_sdk::testutils::AuthorizedInvocation {
                function: AuthorizedFunction::Contract((
                    t.jar.address.clone(),
                    Symbol::new(&t.env, "set_token"),
                    (token.clone(), true).into_val(&t.env),
                )),
                sub_invocations: std::vec![],
            }
        )
    );
    assert!(t.jar.is_token_allowed(&token));
    t.jar.set_token(&token, &false);
    assert!(!t.jar.is_token_allowed(&token));
}

#[test]
fn admin_calls_fail_without_auth() {
    let t = setup();
    t.env.set_auths(&[]);
    assert!(t.jar.try_set_paused(&true).is_err());
    assert!(t.jar.try_set_token(&Address::generate(&t.env), &true).is_err());
    assert!(t.jar.try_set_admin(&Address::generate(&t.env)).is_err());
}

#[test]
fn set_admin_needs_both_signatures() {
    let t = setup();
    let next = Address::generate(&t.env);
    t.jar.set_admin(&next);
    let signers: std::vec::Vec<Address> = t.env.auths().into_iter().map(|(a, _)| a).collect();
    assert!(signers.contains(&t.admin));
    assert!(signers.contains(&next));
    assert_eq!(t.jar.admin(), next);
}
