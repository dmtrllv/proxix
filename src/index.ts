import { useEffect, useState } from "react";
import ReactDOM from "react-dom";

// TODO: 
//   instead of iterating all keys of the root object down,
//	 iterate up and down from the update source. This will hopefully increase performance. 
//   (Needs to be tested ofc :D)

type Dispatchers<T> = React.Dispatch<React.SetStateAction<WrappedState<T>>>[];

export type State<T> = T & {
	readonly [DISPATCHERS]: Dispatchers<T>;
};

type WrappedState<T> = { readonly state: State<T> };

type Ctx<T> = {
	root: State<T>;
};


const DISPATCHERS = Symbol();

const update = <T>(state: State<T>) => {
	for(const k in state) {
		const val = (state as any)[k];
		if(isState(val)) {
			update(val);
		}
	}

	state[DISPATCHERS].forEach((dispatch: any) => dispatch({ state }));
};

const wrapState = <T>(ctx: Ctx<T>, value: any) => {
	const dispatchers: Dispatchers<T> = [];
	
	switch (typeof value) {
		case "object":
			if (value === null)
				return null;
			
			let wrapped: any = {};

			for (const k in value) {
				wrapped[k] = wrapState(ctx, value[k]);
			}
			
			return new Proxy(wrapped, {
				get(target, key) {
					if (key === DISPATCHERS)
						return dispatchers;
					return target[key];
				},
				set(target, key, value) {
					target[key] = wrapState(ctx, value);
					ReactDOM.unstable_batchedUpdates(() => update(ctx.root));
					return true;
				}
			})
		default:
			return value;
	}
};

const createState = <T extends {}>(init: T): T => {
	const ctx: Ctx<T> = {
		dispatchers: [],
		root: init,
		parent: null,
	} as any;

	const state = wrapState(ctx, init);

	ctx.root = state;

	return state;
};

const isState = <T>(val: any): val is State<T> => val[DISPATCHERS] !== undefined;

/**
 * @param init The initial state.
 * @returns A state object to be used by multiple components.
 */
export const state = <T extends object>(init: T) => createState(init);

/**
 * @param state The state to use in the component. This can be a plain object, an object or child object created by the `state(...)` function or be used as a decorator on a class.
 * @returns The watching state.
 */
export const use = <T extends object>(state: T) => {
	const [s, dispatcher] = useState<WrappedState<T>>(() => {
		if (!isState(state)) {
			state = createState(state as any);
		}
		return { state } as WrappedState<T>;
	});

	useEffect(() => {
		s.state[DISPATCHERS].push(dispatcher);
		return () => { s.state[DISPATCHERS].slice(s.state[DISPATCHERS].indexOf(dispatcher), 1); };
	}, [dispatcher]);
	
	return s.state;
};
