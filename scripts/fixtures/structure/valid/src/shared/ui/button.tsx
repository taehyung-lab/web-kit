// shared는 위쪽을 모른다.
export function Button(props: { children?: unknown }) { return <button>{String(props.children)}</button>; }
