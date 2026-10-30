// 파일 책임: 브라우저 적합성 등록 함수의 소비 타입 계약을 제공한다.
import type { ConformanceTarget } from './target.mjs';
export interface BrowserConformanceOptions { readonly url: string; readonly target: ConformanceTarget; }
/** 초기 포커스·Tab·중첩 포털·복원을 검사한다. */
export declare function checkDialogBrowser(options: BrowserConformanceOptions): void;
/** 덮개 차단과 초점 복원의 모든 분기를 검사한다. */
export declare function checkProgressBrowser(options: BrowserConformanceOptions): void;
/** 폼 없이 덮개 자체의 차단·초점 복원 분기를 검사한다. */
export declare function checkProgressFeatureBrowser(options: BrowserConformanceOptions): void;
/** 폼과 덮개를 함께 설치했을 때 서버 오류 초점을 검사한다. */
export declare function checkFormProgressBrowser(options: BrowserConformanceOptions): void;
/** 실제 Enter 제출과 선택 포털의 연결을 검사한다. */
export declare function checkFormBrowser(options: BrowserConformanceOptions): void;
export declare function checkAuthBrowser(options: {
    url: string;
    target: import('./target.mjs').ConformanceTarget;
    enterCode: (page: import('@playwright/test').Page, code: string) => Promise<void>;
    readCode: (page: import('@playwright/test').Page) => Promise<string>;
}): void;
