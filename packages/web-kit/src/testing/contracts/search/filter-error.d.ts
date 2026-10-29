// 파일 책임: 적합성 검사에 주입하는 UI의 구조 타입 계약이며 런타임 구현은 포함하지 않는다.
/** 문구의 번역은 프로젝트가 제공하고 공통은 오류의 접근 가능한 표시를 맡는다. */
export declare function FilterError({ id, message, className, }: {
    readonly id: string;
    readonly message?: string;
    readonly className?: string;
}): import("react").JSX.Element | null;
