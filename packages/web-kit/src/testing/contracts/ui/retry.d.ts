// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
/** 실패 자리의 다시 시도 버튼이 사라질 때만 결과로 focus를 옮긴다. */
import type { ReactNode } from 'react';
/** 재시도 전에 다른 곳으로 이동한 focus는 빼앗지 않는다. */
export declare function RetryRegion({ failed, message, onRetry, controlId, children, retryLabel, }: {
    readonly failed: boolean;
    readonly message?: ReactNode;
    readonly onRetry: () => void;
    readonly controlId: string;
    readonly children: ReactNode;
    readonly retryLabel?: string;
}): string | number | bigint | boolean | Iterable<ReactNode> | Promise<string | number | bigint | boolean | import("react").ReactPortal | import("react").ReactElement<unknown, string | import("react").JSXElementConstructor<any>> | Iterable<ReactNode> | null | undefined> | import("react").JSX.Element | null | undefined;
