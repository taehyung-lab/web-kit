// 파일 책임: 실제 브라우저만 증명할 수 있는 Tab·포털·inert·암묵 제출 기준을 소유한다.
import { test, expect } from '@playwright/test';
import { conformanceTitle } from './target.mjs';
/** 실제 Tab 이벤트가 어떤 순간에도 대화창 밖을 거치지 않는지 기록한다. */
async function observeFocus(page) {
    await page.evaluate(() => {
        window.escaped = false;
        document.addEventListener('focusin', (event) => {
            if (!(event.target instanceof Element) || !event.target.closest('[role="dialog"], [role="alertdialog"]'))
                window.escaped = true;
        });
    });
}
/** 초기 진입·양방향 Tab·중첩 포털·닫기 복원을 검사한다. */
export function checkDialogBrowser({ url, target }) {
    test(conformanceTitle('B-dialog', target, '진입·Tab 순환·중첩 포털·닫기 복원'), async ({ page }) => {
        await page.goto(url);
        await page.getByRole('button', { name: '열기', exact: true }).click();
        const outer = page.getByRole('dialog', { name: '외부 창' });
        await expect(page.getByRole('textbox', { name: '첫 입력', exact: true })).toBeFocused();
        await observeFocus(page);
        await outer.getByRole('button', { name: '닫기', exact: true }).focus();
        await page.keyboard.press('Tab');
        await expect(page.getByRole('textbox', { name: '첫 입력', exact: true })).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(outer.getByRole('button', { name: '닫기', exact: true })).toBeFocused();
        expect(await page.evaluate(() => window.escaped)).toBe(false);
        await page.getByRole('button', { name: '안쪽 열기' }).click();
        await expect(page.getByRole('textbox', { name: '안쪽 입력' })).toBeFocused();
        await page.keyboard.press('Shift+Tab');
        await expect(page.getByRole('button', { name: '안쪽 닫기' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(page.getByRole('dialog', { name: '내부 창' })).toHaveCount(0);
        await expect(page.getByRole('button', { name: '안쪽 열기' })).toBeFocused();
        await page.keyboard.press('Escape');
        await expect(outer).toHaveCount(0);
        await expect(page.getByRole('button', { name: '열기', exact: true })).toBeFocused();
    });
}
/** 덮개 중 실제 좌표 클릭·Tab 차단과 모든 복원 갈래를 검사한다. */
export function checkProgressBrowser({ url, target }) {
    for (const mode of ['restore', 'removed', 'root', 'saved', 'error', 'portal', 'initial', 'from-dialog']) {
        test(conformanceTitle('B-progress-' + mode, target, '덮개 배경 차단과 복원 ' + mode), async ({ page }) => {
            await page.goto(url + '?mode=' + mode);
            if (mode !== 'initial')
                await page.getByRole('button', { name: '시작' }).click();
            if (mode === 'from-dialog') await page.getByRole('button', { name: '별도 확인', exact: true }).click();
            await expect(page.locator('[aria-busy="true"]')).toHaveAttribute('inert', '');
            if (mode === 'portal') {
                await expect(page.getByRole('button', { name: '별도 확인', exact: true })).toBeFocused();
                await page.getByRole('button', { name: '별도 확인', exact: true }).click();
                await expect(page.getByLabel('별도 횟수')).toHaveText('1');
                await page.keyboard.press('Tab');
                await expect(page.getByRole('dialog')).toBeVisible();
            }
            else {
                const box = await page.getByText('본문 작업', { exact: true }).boundingBox();
                if (!box)
                    throw new Error('본문 작업 좌표 없음');
                await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
                await page.keyboard.press('Tab');
                expect(await page.locator('[inert]').evaluate((node) => node.contains(document.activeElement))).toBe(false);
                await expect(page.getByLabel('작업 횟수')).toHaveText('0');
            }
            await page.evaluate(() => window.dispatchEvent(new Event('web-kit:finish')));
            await expect(page.locator('[aria-busy="true"]')).toHaveCount(0);
            if (mode === 'restore' || mode === 'from-dialog')
                await expect(page.getByRole('button', { name: '시작' })).toBeFocused();
            if (mode === 'removed')
                await expect(page.getByRole('heading')).toBeFocused();
            if (mode === 'root')
                await expect(page.locator('.wk-blocking-root')).toBeFocused();
            if (mode === 'saved' || mode === 'portal')
                expect(await page.getByRole('dialog').evaluate((node) => node.contains(document.activeElement))).toBe(true);
            if (mode === 'error')
                await expect(page.getByRole('textbox', { name: '오류 칸' })).toBeFocused();
            if (mode === 'initial')
                expect(await page.evaluate(() => document.activeElement === document.body)).toBe(true);
        });
    }
}
/** 일반·추가·하위 폼의 실제 Enter 결과와 선택 포털의 키보드를 검사한다. */
export function checkFormBrowser({ url, target }) {
    test(conformanceTitle('B-form-protection', target, '기본 보호는 브라우저 이탈을 묻고 보호 제외는 묻지 않는다'), async ({ page }) => {
        for (const protect of [true, false]) {
            await page.goto(url + '?protect=' + protect);
            await page.getByRole('textbox', { name: '제목', exact: true }).fill('changed');
            let dialogs = 0;
            const accept = async (dialog) => { dialogs += 1; await dialog.accept(); };
            page.on('dialog', accept);
            await page.reload();
            page.off('dialog', accept);
            expect(dialogs).toBe(protect ? 1 : 0);
            await expect(page.getByRole('textbox', { name: '제목', exact: true })).toHaveValue('outer');
        }
    });
    test(conformanceTitle('B-enter', target, '일반 입력 Enter는 한 번 저장한다'), async ({ page }) => {
        await page.goto(url);
        await page.getByRole('textbox', { name: '제목', exact: true }).press('Enter');
        await expect(page.getByLabel('바깥 저장')).toHaveText('1');
        await expect(page.getByLabel('안쪽 저장')).toHaveText('0');
    });
    test(conformanceTitle('B-enter-add', target, '추가 Enter는 줄만 추가한다'), async ({ page }) => {
        await page.goto(url);
        await page.getByRole('textbox', { name: '추가 입력' }).press('Enter');
        await expect(page.getByLabel('줄 수')).toHaveText('1');
        await expect(page.getByLabel('바깥 저장')).toHaveText('0');
    });
    test(conformanceTitle('B-enter-inner', target, '하위 Enter는 안쪽만 저장하고 선택 포털은 동작한다'), async ({ page }) => {
        await page.goto(url);
        await page.getByRole('button', { name: '안쪽 열기' }).click();
        await page.getByRole('textbox', { name: '안쪽 코드' }).press('Enter');
        await expect(page.getByLabel('안쪽 저장')).toHaveText('1');
        await expect(page.getByLabel('바깥 저장')).toHaveText('0');
        await page.getByRole('button', { name: '중첩 선택' }).click();
        await page.getByRole('option', { name: 'Alpha' }).click();
        await expect(page.getByRole('dialog', { name: '하위 폼' })).toBeVisible();
        await page.keyboard.press('Tab');
        expect(await page.getByRole('dialog').evaluate((node) => node.contains(document.activeElement))).toBe(true);
    });
}

/** 입력 행동 어댑터로 한 칸과 여러 칸의 실제 Enter·기한·재전송을 검사한다. */
export function checkAuthBrowser({ url, target, enterCode, readCode }) {
    test(conformanceTitle('B-auth', target, '인증 입력 모양과 무관한 Enter·만료·재전송'), async ({ page }) => {
        await page.clock.install({ time: new Date(100000) });
        await page.goto(url);
        await expect(page.getByRole('timer')).toHaveText('남은 시간 5');
        await expect(page.getByRole('button', { name: '재전송', exact: true })).toBeDisabled();
        await expect(page.getByLabel('resend-wait')).toHaveText('대기 3');
        for (const code of ['12', 'abcdef']) {
            await enterCode(page, code);
            await page.keyboard.press('Enter');
            await expect(page.getByLabel('요청 횟수')).toHaveText('0');
            await expect(page.getByRole('alert')).toHaveText('숫자 6자리를 입력하세요');
        }
        await enterCode(page, '123456');
        await page.keyboard.press('Enter');
        await page.keyboard.press('Enter');
        await expect(page.getByLabel('요청 횟수')).toHaveText('1');
        await page.getByRole('button', { name: '응답 성공' }).click();
        await expect(page.getByLabel('적용 코드')).toHaveText('123456');
        await page.clock.runFor(5000);
        await expect(page.getByRole('timer')).toHaveText('남은 시간 0');
        await expect(page.getByText('만료됨', { exact: true })).toBeVisible();
        await enterCode(page, '654321');
        expect(await readCode(page)).toBe('654321');
        await page.keyboard.press('Enter');
        await expect(page.getByLabel('요청 횟수')).toHaveText('1');
        await expect(page.getByRole('button', { name: '확인', exact: true })).toBeDisabled();
        await page.getByRole('button', { name: '재전송', exact: true }).click();
        await page.getByRole('button', { name: '응답 성공' }).click();
        await expect(page.getByRole('timer')).toHaveText('남은 시간 5');
        await expect(page.getByRole('button', { name: '재전송', exact: true })).toBeDisabled();
        await expect(page.getByLabel('resend-wait')).toHaveText('대기 3');
        await page.getByRole('button', { name: '전체 기한 경과' }).click();
        await expect(page.getByRole('timer')).toHaveText('남은 시간 5');
        await expect(page.getByText('만료됨', { exact: true })).toBeVisible();
        await expect(page.getByRole('button', { name: '확인', exact: true })).toBeDisabled();
        await expect(page.getByRole('button', { name: '재전송', exact: true })).toBeDisabled();
    });
    test(conformanceTitle('B-auth-concurrency', target, '확인·재전송의 독립된 관문'), async ({ page }) => {
        await page.clock.install({ time: new Date(100000) });
        for (const first of ['확인', '재전송']) {
            await page.goto(url);
            await page.clock.runFor(3000);
            await enterCode(page, '123456');
            const second = first === '확인' ? '재전송' : '확인';
            await page.getByRole('button', { name: first, exact: true }).click();
            await expect(page.getByRole('button', { name: second, exact: true })).toBeEnabled();
            await page.getByRole('button', { name: second, exact: true }).click();
            await expect(page.getByRole('button', { name: first, exact: true })).toBeDisabled();
            await expect(page.getByRole('button', { name: second, exact: true })).toBeDisabled();
            await expect(page.getByLabel('요청 횟수')).toHaveText('1');
            await expect(page.getByLabel('재전송 횟수')).toHaveText('1');
        }
    });

    test(conformanceTitle('B-auth-failures', target, '확인·재전송 실패 안내의 독립된 수명'), async ({ page }) => {
        await page.clock.install({ time: new Date(100000) });
        await page.goto(url);
        await page.clock.runFor(3000);
        await enterCode(page, '123456');
        const click = (name) => page.getByRole('button', { name, exact: true }).click();
        await click('확인'); await click('응답 실패');
        await expect(page.getByText('확인 실패', { exact: true })).toBeVisible();
        await click('재전송');
        await expect(page.getByText('확인 실패', { exact: true })).toBeVisible();
        await click('응답 성공');
        await expect(page.getByText('확인 실패', { exact: true })).toBeVisible();
        await page.clock.runFor(3000);
        await click('재전송'); await click('응답 실패');
        await expect(page.getByText('확인 실패', { exact: true })).toBeVisible();
        await expect(page.getByText('재전송 실패', { exact: true })).toBeVisible();
        await click('확인');
        await expect(page.getByText('확인 실패', { exact: true })).toHaveCount(0);
        await expect(page.getByText('재전송 실패', { exact: true })).toBeVisible();
        await click('응답 실패'); await click('재전송');
        await expect(page.getByText('확인 실패', { exact: true })).toBeVisible();
        await expect(page.getByText('재전송 실패', { exact: true })).toHaveCount(0);
        await click('응답 실패'); await click('확인'); await click('응답 성공');
        await expect(page.getByText('확인 실패', { exact: true })).toHaveCount(0);
        await expect(page.getByText('재전송 실패', { exact: true })).toBeVisible();
    });

}
