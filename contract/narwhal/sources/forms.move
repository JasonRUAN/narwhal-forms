module narwhal::forms;

use std::string::String;
use sui::clock::Clock;
use sui::event;
use sui::vec_set::{Self, VecSet};

// === Errors ===

#[error]
const ENotMatchingForm: vector<u8> = b"AdminCap does not authorize this form";
#[error]
const EArchived: vector<u8> = b"Form is archived";
#[error]
const ENotAuthorized: vector<u8> = b"Sender is not authorized for this form";
#[error]
const EAllowlistRequiresWallet: vector<u8> = b"Allowlist gating requires require_wallet=true";
#[error]
const ENoDuplicateRequiresWallet: vector<u8> = b"Disallowing duplicate submissions requires require_wallet=true";

// === Structs ===

/// Shared on-chain index for a NARWHAL form. The actual form schema lives
/// on Walrus; the on-chain object only stores the blob pointer plus access
/// metadata used by Seal's `seal_approve` policy.
public struct Form has key {
    id: UID,
    creator: address,
    title: String,
    schema_blob_id: String,
    is_private: bool,
    require_wallet: bool,
    /// When `false`, an address that has already submitted this form is
    /// rejected on subsequent attempts. Requires `require_wallet=true`
    /// (otherwise the form has no notion of submitter identity).
    allow_duplicate: bool,
    /// When non-empty, only addresses contained here may submit a response.
    /// Requires `require_wallet=true`.
    allowlist: VecSet<address>,
    /// Set of addresses that already submitted at least once. Used to enforce
    /// `!allow_duplicate`. Only populated when `require_wallet=true`.
    submitters: VecSet<address>,
    archived: bool,
    admins: VecSet<address>,
    submission_count: u64,
    created_at_ms: u64,
    updated_at_ms: u64,
}

/// Owner-only capability minted to the form creator.
public struct AdminCap has key, store {
    id: UID,
    form_id: ID,
}

// === Events ===

public struct FormCreated has copy, drop {
    form_id: ID,
    creator: address,
    title: String,
    schema_blob_id: String,
    is_private: bool,
    require_wallet: bool,
    allow_duplicate: bool,
    created_at_ms: u64,
}

public struct FormUpdated has copy, drop {
    form_id: ID,
    schema_blob_id: String,
    title: String,
    updated_at_ms: u64,
}

public struct FormArchived has copy, drop {
    form_id: ID,
    archived: bool,
}

public struct AdminAdded has copy, drop {
    form_id: ID,
    admin: address,
}

public struct AdminRemoved has copy, drop {
    form_id: ID,
    admin: address,
}

public struct AllowlistAdded has copy, drop {
    form_id: ID,
    addr: address,
}

public struct AllowlistRemoved has copy, drop {
    form_id: ID,
    addr: address,
}

public struct AllowDuplicateUpdated has copy, drop {
    form_id: ID,
    allow_duplicate: bool,
}

// === Public API ===

/// Pure constructor — returns the freshly created Form and AdminCap so a
/// PTB caller can share/transfer them as desired. Use [`create_and_share`]
/// from a wallet for the one-shot path.
public fun create(
    title: String,
    schema_blob_id: String,
    is_private: bool,
    require_wallet: bool,
    allow_duplicate: bool,
    clock: &Clock,
    ctx: &mut TxContext,
): (Form, AdminCap) {
    // Disallowing duplicates only makes sense when we record the submitter.
    if (!allow_duplicate) {
        assert!(require_wallet, ENoDuplicateRequiresWallet);
    };
    let creator = ctx.sender();
    let now = clock.timestamp_ms();
    let form = Form {
        id: object::new(ctx),
        creator,
        title,
        schema_blob_id,
        is_private,
        require_wallet,
        allow_duplicate,
        allowlist: vec_set::empty<address>(),
        submitters: vec_set::empty<address>(),
        archived: false,
        admins: vec_set::empty<address>(),
        submission_count: 0,
        created_at_ms: now,
        updated_at_ms: now,
    };
    let form_id = object::id(&form);
    let cap = AdminCap {
        id: object::new(ctx),
        form_id,
    };
    event::emit(FormCreated {
        form_id,
        creator,
        title: form.title,
        schema_blob_id: form.schema_blob_id,
        is_private,
        require_wallet,
        allow_duplicate,
        created_at_ms: now,
    });
    (form, cap)
}

/// Convenience entry function: create + share + transfer cap to sender.
entry fun create_and_share(
    title: String,
    schema_blob_id: String,
    is_private: bool,
    require_wallet: bool,
    allow_duplicate: bool,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    let (form, cap) = create(
        title,
        schema_blob_id,
        is_private,
        require_wallet,
        allow_duplicate,
        clock,
        ctx,
    );
    transfer::share_object(form);
    transfer::public_transfer(cap, ctx.sender());
}

public fun update_schema(
    form: &mut Form,
    cap: &AdminCap,
    new_schema_blob_id: String,
    clock: &Clock,
) {
    assert_authorizes(cap, form);
    assert!(!form.archived, EArchived);
    form.schema_blob_id = new_schema_blob_id;
    form.updated_at_ms = clock.timestamp_ms();
    event::emit(FormUpdated {
        form_id: object::id(form),
        schema_blob_id: form.schema_blob_id,
        title: form.title,
        updated_at_ms: form.updated_at_ms,
    });
}

public fun update_title(form: &mut Form, cap: &AdminCap, new_title: String, clock: &Clock) {
    assert_authorizes(cap, form);
    assert!(!form.archived, EArchived);
    form.title = new_title;
    form.updated_at_ms = clock.timestamp_ms();
    event::emit(FormUpdated {
        form_id: object::id(form),
        schema_blob_id: form.schema_blob_id,
        title: form.title,
        updated_at_ms: form.updated_at_ms,
    });
}

public fun set_archived(form: &mut Form, cap: &AdminCap, archived: bool, clock: &Clock) {
    assert_authorizes(cap, form);
    form.archived = archived;
    form.updated_at_ms = clock.timestamp_ms();
    event::emit(FormArchived { form_id: object::id(form), archived });
}

public fun add_admin(form: &mut Form, cap: &AdminCap, admin: address) {
    assert_authorizes(cap, form);
    if (!form.admins.contains(&admin)) {
        form.admins.insert(admin);
    };
    event::emit(AdminAdded { form_id: object::id(form), admin });
}

public fun remove_admin(form: &mut Form, cap: &AdminCap, admin: address) {
    assert_authorizes(cap, form);
    if (form.admins.contains(&admin)) {
        form.admins.remove(&admin);
    };
    event::emit(AdminRemoved { form_id: object::id(form), admin });
}

/// Toggle whether the same address may submit more than once. Switching to
/// `false` requires `require_wallet=true` so the contract can actually
/// enforce uniqueness. Already recorded duplicates (if any) are not
/// retroactively removed.
public fun set_allow_duplicate(form: &mut Form, cap: &AdminCap, allow_duplicate: bool, clock: &Clock) {
    assert_authorizes(cap, form);
    if (!allow_duplicate) {
        assert!(form.require_wallet, ENoDuplicateRequiresWallet);
    };
    form.allow_duplicate = allow_duplicate;
    form.updated_at_ms = clock.timestamp_ms();
    event::emit(AllowDuplicateUpdated {
        form_id: object::id(form),
        allow_duplicate,
    });
}

/// Add an address to the submission allowlist. Once the allowlist is
/// non-empty, only listed addresses can submit. Requires `require_wallet=true`.
public fun add_allowlist(form: &mut Form, cap: &AdminCap, addr: address) {
    assert_authorizes(cap, form);
    assert!(form.require_wallet, EAllowlistRequiresWallet);
    if (!form.allowlist.contains(&addr)) {
        form.allowlist.insert(addr);
    };
    event::emit(AllowlistAdded { form_id: object::id(form), addr });
}

public fun remove_allowlist(form: &mut Form, cap: &AdminCap, addr: address) {
    assert_authorizes(cap, form);
    if (form.allowlist.contains(&addr)) {
        form.allowlist.remove(&addr);
    };
    event::emit(AllowlistRemoved { form_id: object::id(form), addr });
}

// === Read-only getters ===

public fun creator(form: &Form): address { form.creator }
public fun title(form: &Form): &String { &form.title }
public fun schema_blob_id(form: &Form): &String { &form.schema_blob_id }
public fun is_private(form: &Form): bool { form.is_private }
public fun require_wallet(form: &Form): bool { form.require_wallet }
public fun allow_duplicate(form: &Form): bool { form.allow_duplicate }
public fun archived(form: &Form): bool { form.archived }
public fun submission_count(form: &Form): u64 { form.submission_count }
public fun admins(form: &Form): &VecSet<address> { &form.admins }
public fun is_admin(form: &Form, addr: address): bool { form.admins.contains(&addr) }
public fun allowlist(form: &Form): &VecSet<address> { &form.allowlist }
public fun is_allowlisted(form: &Form, addr: address): bool { form.allowlist.contains(&addr) }
public fun allowlist_size(form: &Form): u64 { form.allowlist.length() }
public fun has_submitted(form: &Form, addr: address): bool { form.submitters.contains(&addr) }

/// True if `addr` is the creator or an allowlisted admin. Used by Seal's
/// `seal_approve` policy and by submission-update entry points.
public fun is_authorized(form: &Form, addr: address): bool {
    form.creator == addr || form.admins.contains(&addr)
}

public fun cap_form_id(cap: &AdminCap): ID { cap.form_id }

// === Package-level accessors (for sibling modules) ===

public(package) fun uid_mut(form: &mut Form): &mut UID { &mut form.id }
public(package) fun uid(form: &Form): &UID { &form.id }

public(package) fun increment_submissions(form: &mut Form): u64 {
    let i = form.submission_count;
    form.submission_count = i + 1;
    i
}

/// Record that `addr` has submitted at least once. Idempotent. Used by the
/// `submissions` module to enforce `!allow_duplicate`.
public(package) fun record_submitter(form: &mut Form, addr: address) {
    if (!form.submitters.contains(&addr)) {
        form.submitters.insert(addr);
    };
}

public(package) fun assert_authorizes(cap: &AdminCap, form: &Form) {
    assert!(cap.form_id == object::id(form), ENotMatchingForm);
}

public(package) fun assert_authorized_sender(form: &Form, addr: address) {
    assert!(is_authorized(form, addr), ENotAuthorized);
}

// === Test-only helpers ===

#[test_only]
public fun destroy_for_testing(form: Form, cap: AdminCap) {
    let Form { id, .. } = form;
    id.delete();
    let AdminCap { id, .. } = cap;
    id.delete();
}
