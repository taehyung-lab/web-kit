export const conformancePackageVersion = '5.0.0-rc.3';
/** 단위·브라우저 러너의 기본 JSON 보고서에 보존되는 검사 제목을 만든다. */
export function conformanceTitle(id, target, label) {
    return '[web-kit:' + [id, conformancePackageVersion, target.registryVersion, target.registryCommit].map(encodeURIComponent).join('|') + '] ' + label;
}
