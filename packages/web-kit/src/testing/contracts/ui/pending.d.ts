// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
/** 회전 표시 하나. 문구는 부르는 쪽이 둔다(낭독기에는 숨김). */
export declare function Spinner({ large }: {
    readonly large?: boolean;
}): import("react").JSX.Element;
/** 진행 중 표시: 버튼 바로 뒤에 둔다. label은 화면 낭독기에만 읽히는 문구다. */
export declare function Pending({ label }: {
    readonly label: string;
}): import("react").JSX.Element;
