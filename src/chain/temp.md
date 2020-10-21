# Merging chains

Two users' chains may diverge, and when they reconnect their chains will need to be merged.

## Two-way merge

```
Alice:     A U M P W Q
Bob:       A U M P W Z B D
```

There are two possible ways of merging these:

```
A U M P W Q Z B D
A U M P W Z B D Q
```

(I think we want to treat the divergent segments atomically - so `Z B D` is a single unit, and it's
not an option to merge `Q` into the middle of it.)

### Things I haven't figured out

We need a deterministic comparison function that takes two chain segments and indicates which one is
to go first.

- Start with something arbitrary but deterministic; we'll need this as a tie-breaker.
- The tie-breaker needs to be impossible to game. Could be a hash that combines the hashes of the
  two segments, but in different orders.
- The

How do we handle a situation where the resulting chain doesn't validate? e.g. `Z` removes a user and
`Q` gives the user a role.

- we could just

## N-way merge

How does this play out with multiple divergences, reconciled in different orders?

```
Alice:     A U M P W Q
Bob:       A U M P W Z B D
Charlie:   A U M P W Z B C

Alice + Bob:
A U M P W Q Z B D
or
A U M P W Z B D Q

Alice + Charlie:
```
