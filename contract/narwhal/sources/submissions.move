module narwhal::submissions;

use narwhal::forms::{Self, Form, AdminCap};
use std::string::String;
use sui::clock::Clock;
use sui::dynamic_field as df;
use sui::event;

// === Errors ===

#[error]
const EInvalidPriority: vector<u8> = b"Priority must be in [0, 3]";
#[error]
const EArchived: vector<u8> = b"Form is archived";
#[error]
const ESubmissionMissing: vector<u8> = b"Submission index does not exist";
#[error]
const EEmptyBatch: vector<u8> = b"Batch must contain at least one index";
#[error]
const EBatchTooLarge: vector<u8> = b"Batch size exceeds MAX_BATCH";
#[error]
const ENotAllowlisted: vector<u8> = b"Submitter is not on the form's allowlist";
#[error]
const EAlreadySubmitted: vector<u8> = b"This address has already submitted to the form";

const MAX_PRIORITY: u8 = 3;
/// Cap on how many submissions a single batch entry may touch in one tx.
/// Sized so a full batch comfortably fits within Sui's per-tx gas budget
/// while still being useful for triage workflows.
const MAX_BATCH: u64 = 256;

// === Structs ===

/// Dynamic-field key wrapping a submission index. Positional struct keeps
/// the encoded key compact.
public struct SubmissionKey(u64) has copy, drop, store;

/// Per-response record stored as a dynamic field on the parent Form.
/// `response_blob_id` points at a Walrus blob; `encrypted_field_ids`
/// enumerates the JSON-path field IDs whose values are individually
/// Seal-encrypted (used by the hybrid encryption mode).
public struct Submission has store {
    submitter: Option<address>,
    response_blob_id: String,
    encrypted_field_ids: vector<String>,
    priority: u8,
    tag: String,
    note_blob_id: Option<String>,
    created_at_ms: u64,
    updated_at_ms: u64,
}

// === Events ===

public struct SubmissionAdded has copy, drop {
    form_id: ID,
    index: u64,
    submitter: Option<address>,
    response_blob_id: String,
    encrypted_field_ids: vector<String>,
    created_at_ms: u64,
}

public struct SubmissionUpdated has copy, drop {
    form_id: ID,
    index: u64,
    priority: u8,
    tag: String,
    note_blob_id: Option<String>,
    updated_at_ms: u64,
}

// === Public API ===

/// Append a new response to a Form. When `require_wallet` is set on the
/// form we record the sender; otherwise we record `none()` to keep
/// responses anonymous in the on-chain index even though the Sui tx still
/// surfaces a fee payer.
///
/// Additional gating (only meaningful when `require_wallet=true`):
/// * If the form's `allowlist` is non-empty, the sender must be listed.
/// * If `allow_duplicate=false`, the sender must not have submitted before.
public fun submit(
    form: &mut Form,
    response_blob_id: String,
    encrypted_field_ids: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
): u64 {
    assert!(!forms::archived(form), EArchived);

    let sender = ctx.sender();
    let require_wallet = forms::require_wallet(form);

    // Allowlist gating only applies when wallets are recorded — otherwise
    // we can't tell who the sender is in any meaningful, anonymous-safe way.
    if (require_wallet && forms::allowlist_size(form) > 0) {
        assert!(forms::is_allowlisted(form, sender), ENotAllowlisted);
    };

    // Duplicate gating mirrors the same prerequisite. `allow_duplicate=false`
    // is forbidden at create-time without `require_wallet=true`, so this is
    // purely a defensive check.
    if (require_wallet && !forms::allow_duplicate(form)) {
        assert!(!forms::has_submitted(form, sender), EAlreadySubmitted);
    };

    let submitter = if (require_wallet) {
        option::some(sender)
    } else {
        option::none<address>()
    };

    let now = clock.timestamp_ms();
    let submission = Submission {
        submitter,
        response_blob_id,
        encrypted_field_ids,
        priority: 0,
        tag: b"".to_string(),
        note_blob_id: option::none(),
        created_at_ms: now,
        updated_at_ms: now,
    };

    let index = forms::increment_submissions(form);
    let form_id = object::id(form);
    let evt_blob = submission.response_blob_id;
    let evt_fields = submission.encrypted_field_ids;
    let evt_submitter = submission.submitter;
    df::add(forms::uid_mut(form), SubmissionKey(index), submission);

    // Track that this address has submitted (used to enforce !allow_duplicate
    // on subsequent calls). Only meaningful when require_wallet=true.
    if (require_wallet) {
        forms::record_submitter(form, sender);
    };

    event::emit(SubmissionAdded {
        form_id,
        index,
        submitter: evt_submitter,
        response_blob_id: evt_blob,
        encrypted_field_ids: evt_fields,
        created_at_ms: now,
    });

    index
}

/// Convenience entry version (no return value) for plain wallet submits.
entry fun submit_entry(
    form: &mut Form,
    response_blob_id: String,
    encrypted_field_ids: vector<String>,
    clock: &Clock,
    ctx: &mut TxContext,
) {
    submit(form, response_blob_id, encrypted_field_ids, clock, ctx);
}

/// Set/override the priority on an existing submission. Either the form
/// creator (via wallet) or any address in the admin allowlist may call
/// this — both are checked against `forms::is_authorized`.
public fun set_priority(
    form: &mut Form,
    index: u64,
    priority: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    forms::assert_authorized_sender(form, ctx.sender());
    assert!(priority <= MAX_PRIORITY, EInvalidPriority);
    let form_id = object::id(form);
    let now = clock.timestamp_ms();
    let s: &mut Submission = df::borrow_mut(forms::uid_mut(form), SubmissionKey(index));
    s.priority = priority;
    s.updated_at_ms = now;
    event::emit(SubmissionUpdated {
        form_id,
        index,
        priority: s.priority,
        tag: s.tag,
        note_blob_id: s.note_blob_id,
        updated_at_ms: now,
    });
}

public fun set_tag(
    form: &mut Form,
    index: u64,
    tag: String,
    clock: &Clock,
    ctx: &TxContext,
) {
    forms::assert_authorized_sender(form, ctx.sender());
    let form_id = object::id(form);
    let now = clock.timestamp_ms();
    let s: &mut Submission = df::borrow_mut(forms::uid_mut(form), SubmissionKey(index));
    s.tag = tag;
    s.updated_at_ms = now;
    event::emit(SubmissionUpdated {
        form_id,
        index,
        priority: s.priority,
        tag: s.tag,
        note_blob_id: s.note_blob_id,
        updated_at_ms: now,
    });
}

public fun attach_note(
    form: &mut Form,
    index: u64,
    note_blob_id: String,
    clock: &Clock,
    ctx: &TxContext,
) {
    forms::assert_authorized_sender(form, ctx.sender());
    let form_id = object::id(form);
    let now = clock.timestamp_ms();
    let s: &mut Submission = df::borrow_mut(forms::uid_mut(form), SubmissionKey(index));
    s.note_blob_id = option::some(note_blob_id);
    s.updated_at_ms = now;
    event::emit(SubmissionUpdated {
        form_id,
        index,
        priority: s.priority,
        tag: s.tag,
        note_blob_id: s.note_blob_id,
        updated_at_ms: now,
    });
}

public fun clear_note(form: &mut Form, index: u64, clock: &Clock, ctx: &TxContext) {
    forms::assert_authorized_sender(form, ctx.sender());
    let form_id = object::id(form);
    let now = clock.timestamp_ms();
    let s: &mut Submission = df::borrow_mut(forms::uid_mut(form), SubmissionKey(index));
    s.note_blob_id = option::none();
    s.updated_at_ms = now;
    event::emit(SubmissionUpdated {
        form_id,
        index,
        priority: s.priority,
        tag: s.tag,
        note_blob_id: s.note_blob_id,
        updated_at_ms: now,
    });
}

/// Combined update used by the admin console — everything in one tx.
entry fun update_submission(
    form: &mut Form,
    cap: &AdminCap,
    index: u64,
    priority: u8,
    tag: String,
    set_note: bool,
    note_blob_id: String,
    clock: &Clock,
    ctx: &TxContext,
) {
    forms::assert_authorizes(cap, form);
    forms::assert_authorized_sender(form, ctx.sender());
    assert!(priority <= MAX_PRIORITY, EInvalidPriority);
    let form_id = object::id(form);
    let now = clock.timestamp_ms();
    let s: &mut Submission = df::borrow_mut(forms::uid_mut(form), SubmissionKey(index));
    s.priority = priority;
    s.tag = tag;
    if (set_note) {
        s.note_blob_id = option::some(note_blob_id);
    } else {
        s.note_blob_id = option::none();
    };
    s.updated_at_ms = now;
    event::emit(SubmissionUpdated {
        form_id,
        index,
        priority: s.priority,
        tag: s.tag,
        note_blob_id: s.note_blob_id,
        updated_at_ms: now,
    });
}

// === Batch updates ===
//
// All three batch helpers apply the *same* new value to every submission in
// `indices` and emit one `SubmissionUpdated` event per affected index. Doing
// it this way keeps existing event-replay indexers (the frontend included)
// compatible without any change — a single batch call just looks like N
// back-to-back single updates with identical `updated_at_ms`.
//
// Authorization mirrors the single-index siblings (`set_priority`, `set_tag`,
// `clear_note`): a sender check against `forms::is_authorized`, no AdminCap
// required, so allowlisted admins can use the batch path too. Visibility is
// `public` so the functions are callable both from PTBs and from
// in-package tests.

/// Set the same priority on many submissions in one tx.
public fun batch_set_priority(
    form: &mut Form,
    indices: vector<u64>,
    priority: u8,
    clock: &Clock,
    ctx: &TxContext,
) {
    forms::assert_authorized_sender(form, ctx.sender());
    assert!(priority <= MAX_PRIORITY, EInvalidPriority);
    let n = indices.length();
    assert!(n > 0, EEmptyBatch);
    assert!(n <= MAX_BATCH, EBatchTooLarge);

    let form_id = object::id(form);
    let now = clock.timestamp_ms();
    let mut i = 0;
    while (i < n) {
        let idx = indices[i];
        let s: &mut Submission = df::borrow_mut(forms::uid_mut(form), SubmissionKey(idx));
        s.priority = priority;
        s.updated_at_ms = now;
        event::emit(SubmissionUpdated {
            form_id,
            index: idx,
            priority: s.priority,
            tag: s.tag,
            note_blob_id: s.note_blob_id,
            updated_at_ms: now,
        });
        i = i + 1;
    };
}

/// Set the same tag string on many submissions in one tx.
public fun batch_set_tag(
    form: &mut Form,
    indices: vector<u64>,
    tag: String,
    clock: &Clock,
    ctx: &TxContext,
) {
    forms::assert_authorized_sender(form, ctx.sender());
    let n = indices.length();
    assert!(n > 0, EEmptyBatch);
    assert!(n <= MAX_BATCH, EBatchTooLarge);

    let form_id = object::id(form);
    let now = clock.timestamp_ms();
    let mut i = 0;
    while (i < n) {
        let idx = indices[i];
        let s: &mut Submission = df::borrow_mut(forms::uid_mut(form), SubmissionKey(idx));
        s.tag = tag;
        s.updated_at_ms = now;
        event::emit(SubmissionUpdated {
            form_id,
            index: idx,
            priority: s.priority,
            tag: s.tag,
            note_blob_id: s.note_blob_id,
            updated_at_ms: now,
        });
        i = i + 1;
    };
}

/// Clear pinned internal notes on many submissions in one tx. (Attaching the
/// *same* note blob to many records would conflate distinct contexts, so we
/// only expose the cleanup direction in batch form.)
public fun batch_clear_notes(
    form: &mut Form,
    indices: vector<u64>,
    clock: &Clock,
    ctx: &TxContext,
) {
    forms::assert_authorized_sender(form, ctx.sender());
    let n = indices.length();
    assert!(n > 0, EEmptyBatch);
    assert!(n <= MAX_BATCH, EBatchTooLarge);

    let form_id = object::id(form);
    let now = clock.timestamp_ms();
    let mut i = 0;
    while (i < n) {
        let idx = indices[i];
        let s: &mut Submission = df::borrow_mut(forms::uid_mut(form), SubmissionKey(idx));
        s.note_blob_id = option::none();
        s.updated_at_ms = now;
        event::emit(SubmissionUpdated {
            form_id,
            index: idx,
            priority: s.priority,
            tag: s.tag,
            note_blob_id: s.note_blob_id,
            updated_at_ms: now,
        });
        i = i + 1;
    };
}

// === Read getters ===

public fun has_submission(form: &Form, index: u64): bool {
    df::exists_with_type<SubmissionKey, Submission>(forms::uid(form), SubmissionKey(index))
}

public fun submission_at(form: &Form, index: u64): &Submission {
    assert!(has_submission(form, index), ESubmissionMissing);
    df::borrow(forms::uid(form), SubmissionKey(index))
}

public fun submitter(s: &Submission): &Option<address> { &s.submitter }
public fun response_blob_id(s: &Submission): &String { &s.response_blob_id }
public fun encrypted_field_ids(s: &Submission): &vector<String> { &s.encrypted_field_ids }
public fun priority(s: &Submission): u8 { s.priority }
public fun tag(s: &Submission): &String { &s.tag }
public fun note_blob_id(s: &Submission): &Option<String> { &s.note_blob_id }
public fun created_at_ms(s: &Submission): u64 { s.created_at_ms }
public fun updated_at_ms(s: &Submission): u64 { s.updated_at_ms }
