/**
 * Collapses runs of two or more slashes into one.
 *
 * A `//`-prefixed path is read by the browser as protocol-relative - the first segment becomes the
 * host - so `history.pushState` rejects it with a SecurityError (issue #97470). Three or more slashes
 * resolve the same way, which is why this matches `{2,}` rather than an exact pair.
 *
 * Pass the path only: a query param can legitimately carry `//` (an encoded URL, for example).
 */
function collapseRepeatedSlashes(path: string): string {
    return path.replaceAll(/\/{2,}/g, '/');
}

export default collapseRepeatedSlashes;
