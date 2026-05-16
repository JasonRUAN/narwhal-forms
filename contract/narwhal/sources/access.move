module narwhal::access;

use narwhal::forms::{Self, Form};

#[error]
const EInvalidIdentity: vector<u8> = b"Identity must be prefixed with the form ID";
#[error]
const ENoAccess: vector<u8> = b"Sender is not authorized to decrypt this form's responses";

/// Seal access-control entry function. Seal key servers dry-run this with
/// `id = formIdBytes || optional_field_id`. Decryption is granted only if:
///   1. the identity bytes start with the form's 32-byte object ID, and
///   2. the transaction sender is the form creator or in the admin
///      allowlist.
entry fun seal_approve(id: vector<u8>, form: &Form, ctx: &TxContext) {
    let form_id_bytes = object::id_to_bytes(&object::id(form));
    assert!(starts_with(&id, &form_id_bytes), EInvalidIdentity);
    assert!(forms::is_authorized(form, ctx.sender()), ENoAccess);
}

fun starts_with(haystack: &vector<u8>, prefix: &vector<u8>): bool {
    let plen = prefix.length();
    if (haystack.length() < plen) return false;
    let mut i = 0;
    while (i < plen) {
        if (haystack[i] != prefix[i]) return false;
        i = i + 1;
    };
    true
}

#[test_only]
public fun assert_seal_approve(id: vector<u8>, form: &Form, ctx: &TxContext) {
    seal_approve(id, form, ctx);
}
