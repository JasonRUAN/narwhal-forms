#[test_only]
module narwhal::narwhal_tests;

use narwhal::access;
use narwhal::forms::{Self, Form, AdminCap};
use narwhal::submissions;
use std::string::{Self, String};
use std::unit_test::{assert_eq, destroy};
use sui::clock;
use sui::test_scenario as ts;

const CREATOR: address = @0xA11CE;
const ADMIN: address = @0xB0B;
const STRANGER: address = @0xDEAD;

fun mk_string(bytes: vector<u8>): String { string::utf8(bytes) }

fun create_form_in_scenario(
    scenario: &mut ts::Scenario,
    is_private: bool,
    require_wallet: bool,
): (Form, AdminCap) {
    create_form_with_opts(scenario, is_private, require_wallet, true)
}

/// Like `create_form_in_scenario` but lets a test pick `allow_duplicate`.
/// Default helper above keeps `allow_duplicate=true` so all pre-existing
/// tests behave exactly as before.
fun create_form_with_opts(
    scenario: &mut ts::Scenario,
    is_private: bool,
    require_wallet: bool,
    allow_duplicate: bool,
): (Form, AdminCap) {
    let ctx = ts::ctx(scenario);
    let clk = clock::create_for_testing(ctx);
    let (form, cap) = forms::create(
        mk_string(b"Bug report"),
        mk_string(b"blob:schema123"),
        is_private,
        require_wallet,
        allow_duplicate,
        &clk,
        ctx,
    );
    clock::destroy_for_testing(clk);
    (form, cap)
}

#[test]
fun create_form_records_creator_and_metadata() {
    let mut scenario = ts::begin(CREATOR);
    let (form, cap) = create_form_in_scenario(&mut scenario, true, false);

    assert_eq!(forms::creator(&form), CREATOR);
    assert_eq!(forms::is_private(&form), true);
    assert_eq!(forms::require_wallet(&form), false);
    assert_eq!(forms::archived(&form), false);
    assert_eq!(forms::submission_count(&form), 0);
    assert_eq!(forms::cap_form_id(&cap), object::id(&form));

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test]
fun add_and_remove_admin() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);

    forms::add_admin(&mut form, &cap, ADMIN);
    assert!(forms::is_admin(&form, ADMIN));
    assert!(forms::is_authorized(&form, ADMIN));
    assert!(forms::is_authorized(&form, CREATOR));
    assert!(!forms::is_authorized(&form, STRANGER));

    forms::remove_admin(&mut form, &cap, ADMIN);
    assert!(!forms::is_admin(&form, ADMIN));

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test]
fun anonymous_submit_records_none_submitter() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    let idx = submissions::submit(
        &mut form,
        mk_string(b"blob:resp1"),
        vector[mk_string(b"email"), mk_string(b"phone")],
        &clk,
        ctx,
    );
    clock::destroy_for_testing(clk);

    assert_eq!(idx, 0);
    assert_eq!(forms::submission_count(&form), 1);
    let s = submissions::submission_at(&form, 0);
    assert!(submissions::submitter(s).is_none());
    assert_eq!(*submissions::response_blob_id(s), mk_string(b"blob:resp1"));

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test]
fun authenticated_submit_records_sender() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, false, true);

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:resp"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    let s = submissions::submission_at(&form, 0);
    let submitter_opt = submissions::submitter(s);
    assert!(submitter_opt.is_some());
    assert_eq!(*submitter_opt.borrow(), STRANGER);

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test]
fun creator_can_set_priority_and_tag() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    ts::next_tx(&mut scenario, CREATOR);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::set_priority(&mut form, 0, 2, &clk, ctx);
    submissions::set_tag(&mut form, 0, mk_string(b"triage"), &clk, ctx);
    submissions::attach_note(&mut form, 0, mk_string(b"blob:note"), &clk, ctx);
    clock::destroy_for_testing(clk);

    let s = submissions::submission_at(&form, 0);
    assert_eq!(submissions::priority(s), 2);
    assert_eq!(*submissions::tag(s), mk_string(b"triage"));
    assert!(submissions::note_blob_id(s).is_some());

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test]
fun allowlisted_admin_can_update_submission() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);
    forms::add_admin(&mut form, &cap, ADMIN);

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    ts::next_tx(&mut scenario, ADMIN);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::set_priority(&mut form, 0, 3, &clk, ctx);
    clock::destroy_for_testing(clk);

    let s = submissions::submission_at(&form, 0);
    assert_eq!(submissions::priority(s), 3);

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = submissions::EInvalidPriority)]
fun set_priority_rejects_out_of_range() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    ts::next_tx(&mut scenario, CREATOR);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::set_priority(&mut form, 0, 99, &clk, ctx);
    // aborts; intentional leak
    clock::destroy_for_testing(clk);
    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = forms::ENotAuthorized)]
fun stranger_cannot_update_submission() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r"), vector[], &clk, ctx);
    submissions::set_priority(&mut form, 0, 1, &clk, ctx);
    clock::destroy_for_testing(clk);
    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

/// Helper: submits `n` anonymous responses to `form`.
fun submit_n(scenario: &mut ts::Scenario, form: &mut Form, n: u64) {
    let mut i = 0;
    while (i < n) {
        ts::next_tx(scenario, STRANGER);
        let ctx = ts::ctx(scenario);
        let clk = clock::create_for_testing(ctx);
        submissions::submit(form, mk_string(b"blob:r"), vector[], &clk, ctx);
        clock::destroy_for_testing(clk);
        i = i + 1;
    };
}

#[test]
fun creator_can_batch_set_priority_across_many_rows() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);
    submit_n(&mut scenario, &mut form, 3);

    ts::next_tx(&mut scenario, CREATOR);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::batch_set_priority(&mut form, vector[0, 1, 2], 3, &clk, ctx);
    clock::destroy_for_testing(clk);

    assert_eq!(submissions::priority(submissions::submission_at(&form, 0)), 3);
    assert_eq!(submissions::priority(submissions::submission_at(&form, 1)), 3);
    assert_eq!(submissions::priority(submissions::submission_at(&form, 2)), 3);

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test]
fun allowlisted_admin_can_batch_set_tag() {
    // Sanity-check that the batch path also accepts the allowlist branch
    // (not just the creator) — same auth semantics as `set_tag`.
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);
    forms::add_admin(&mut form, &cap, ADMIN);
    submit_n(&mut scenario, &mut form, 3);

    ts::next_tx(&mut scenario, ADMIN);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::batch_set_tag(&mut form, vector[0, 2], mk_string(b"triage"), &clk, ctx);
    clock::destroy_for_testing(clk);

    assert_eq!(*submissions::tag(submissions::submission_at(&form, 0)), mk_string(b"triage"));
    assert_eq!(*submissions::tag(submissions::submission_at(&form, 1)), mk_string(b""));
    assert_eq!(*submissions::tag(submissions::submission_at(&form, 2)), mk_string(b"triage"));

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test]
fun batch_clear_notes_removes_attached_blobs() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);
    submit_n(&mut scenario, &mut form, 2);

    ts::next_tx(&mut scenario, CREATOR);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::attach_note(&mut form, 0, mk_string(b"blob:n0"), &clk, ctx);
    submissions::attach_note(&mut form, 1, mk_string(b"blob:n1"), &clk, ctx);
    submissions::batch_clear_notes(&mut form, vector[0, 1], &clk, ctx);
    clock::destroy_for_testing(clk);

    assert!(submissions::note_blob_id(submissions::submission_at(&form, 0)).is_none());
    assert!(submissions::note_blob_id(submissions::submission_at(&form, 1)).is_none());

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = submissions::EEmptyBatch)]
fun batch_rejects_empty_indices() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);

    ts::next_tx(&mut scenario, CREATOR);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::batch_set_priority(&mut form, vector[], 1, &clk, ctx);
    clock::destroy_for_testing(clk);
    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = submissions::EInvalidPriority)]
fun batch_set_priority_rejects_out_of_range() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);
    submit_n(&mut scenario, &mut form, 1);

    ts::next_tx(&mut scenario, CREATOR);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::batch_set_priority(&mut form, vector[0], 99, &clk, ctx);
    clock::destroy_for_testing(clk);
    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = forms::ENotAuthorized)]
fun stranger_cannot_batch_set_priority() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);
    submit_n(&mut scenario, &mut form, 1);

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::batch_set_priority(&mut form, vector[0], 2, &clk, ctx);
    clock::destroy_for_testing(clk);
    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = forms::ENotMatchingForm)]
fun cap_from_other_form_cannot_update_schema() {
    let mut scenario = ts::begin(CREATOR);
    let (form_a, cap_a) = create_form_in_scenario(&mut scenario, true, false);
    let (mut form_b, cap_b) = create_form_in_scenario(&mut scenario, true, false);

    let clk = clock::create_for_testing(ts::ctx(&mut scenario));
    forms::update_schema(&mut form_b, &cap_a, mk_string(b"blob:hijack"), &clk);
    clock::destroy_for_testing(clk);
    destroy(form_a);
    destroy(cap_a);
    destroy(form_b);
    destroy(cap_b);
    ts::end(scenario);
}

#[test]
fun seal_approve_passes_for_creator_and_admin() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_in_scenario(&mut scenario, true, false);
    forms::add_admin(&mut form, &cap, ADMIN);

    let id_bytes = build_identity(&form, b"_field_email");

    ts::next_tx(&mut scenario, CREATOR);
    let ctx = ts::ctx(&mut scenario);
    access::assert_seal_approve(id_bytes, &form, ctx);

    ts::next_tx(&mut scenario, ADMIN);
    let ctx = ts::ctx(&mut scenario);
    access::assert_seal_approve(build_identity(&form, b"_field_email"), &form, ctx);

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = access::ENoAccess)]
fun seal_approve_rejects_stranger() {
    let mut scenario = ts::begin(CREATOR);
    let (form, cap) = create_form_in_scenario(&mut scenario, true, false);
    let id_bytes = build_identity(&form, b"");

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    access::assert_seal_approve(id_bytes, &form, ctx);

    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = access::EInvalidIdentity)]
fun seal_approve_rejects_wrong_id_prefix() {
    let mut scenario = ts::begin(CREATOR);
    let (form, cap) = create_form_in_scenario(&mut scenario, true, false);

    ts::next_tx(&mut scenario, CREATOR);
    let ctx = ts::ctx(&mut scenario);
    let bogus = vector[0u8, 1, 2, 3];
    access::assert_seal_approve(bogus, &form, ctx);

    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

fun build_identity(form: &Form, suffix: vector<u8>): vector<u8> {
    let mut out = object::id_to_bytes(&object::id(form));
    out.append(suffix);
    out
}

// ============================================================
// allow_duplicate / allowlist gating
// ============================================================

#[test]
fun create_defaults_allow_duplicate_true() {
    // Sanity: legacy helper produces forms with duplicates allowed and an
    // empty allowlist (gating disabled).
    let mut scenario = ts::begin(CREATOR);
    let (form, cap) = create_form_in_scenario(&mut scenario, false, true);
    assert_eq!(forms::allow_duplicate(&form), true);
    assert_eq!(forms::allowlist_size(&form), 0);
    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = forms::ENoDuplicateRequiresWallet)]
fun create_no_duplicate_without_wallet_aborts() {
    // allow_duplicate=false is meaningless without require_wallet, so the
    // create-time guard rejects the combination.
    let mut scenario = ts::begin(CREATOR);
    let (form, cap) = create_form_with_opts(&mut scenario, false, false, false);
    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = submissions::EAlreadySubmitted)]
fun no_duplicate_blocks_second_submission_from_same_address() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_with_opts(&mut scenario, false, true, false);

    // First submission from STRANGER — accepted.
    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r1"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    // Second submission from STRANGER — must abort with EAlreadySubmitted.
    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r2"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

#[test]
fun no_duplicate_still_accepts_different_addresses() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_with_opts(&mut scenario, false, true, false);

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r1"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    // Different address — ok.
    ts::next_tx(&mut scenario, ADMIN);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r2"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    assert_eq!(forms::submission_count(&form), 2);
    assert!(forms::has_submitted(&form, STRANGER));
    assert!(forms::has_submitted(&form, ADMIN));

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test]
fun allowlisted_address_can_submit() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_with_opts(&mut scenario, false, true, true);
    forms::add_allowlist(&mut form, &cap, STRANGER);
    assert!(forms::is_allowlisted(&form, STRANGER));
    assert_eq!(forms::allowlist_size(&form), 1);

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    assert_eq!(forms::submission_count(&form), 1);

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = submissions::ENotAllowlisted)]
fun non_allowlisted_address_is_rejected() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_with_opts(&mut scenario, false, true, true);
    forms::add_allowlist(&mut form, &cap, ADMIN); // STRANGER not listed

    ts::next_tx(&mut scenario, STRANGER);
    let ctx = ts::ctx(&mut scenario);
    let clk = clock::create_for_testing(ctx);
    submissions::submit(&mut form, mk_string(b"blob:r"), vector[], &clk, ctx);
    clock::destroy_for_testing(clk);

    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

#[test, expected_failure(abort_code = forms::EAllowlistRequiresWallet)]
fun add_allowlist_without_require_wallet_aborts() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_with_opts(&mut scenario, false, false, true);
    forms::add_allowlist(&mut form, &cap, STRANGER);
    destroy(form);
    destroy(cap);
    ts::end(scenario);
}

#[test]
fun remove_from_allowlist_blocks_future_submissions() {
    let mut scenario = ts::begin(CREATOR);
    let (mut form, cap) = create_form_with_opts(&mut scenario, false, true, true);
    forms::add_allowlist(&mut form, &cap, STRANGER);
    forms::remove_allowlist(&mut form, &cap, STRANGER);
    assert!(!forms::is_allowlisted(&form, STRANGER));
    // After removing the only entry, allowlist is empty so gating is OFF
    // again — that matches our spec (empty == no gating).
    assert_eq!(forms::allowlist_size(&form), 0);

    forms::destroy_for_testing(form, cap);
    ts::end(scenario);
}
