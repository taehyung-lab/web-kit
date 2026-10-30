// 파일 책임: 검사 결과의 버전 식별자 타입을 제공한다.
export interface ConformanceTarget { readonly registryVersion: string; readonly registryCommit: string; }
export declare const conformancePackageVersion: string;
/** 결과 제목에 검사와 대상 버전을 함께 기록한다. */
export declare function conformanceTitle(id: string, target: ConformanceTarget, label: string): string;
