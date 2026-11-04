/** Outcome of an operation a correct caller can legitimately see fail. */
export type Result<T, E = Error> =
	| { ok: true; value: T }
	| { ok: false; error: E };

export function succeed<T>(value: T): Result<T, never> {
	return { ok: true, value };
}

export function fail<E = Error>(error: E): Result<never, E> {
	return { ok: false, error };
}
