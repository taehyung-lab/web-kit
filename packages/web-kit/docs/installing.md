# 설치와 업그레이드

책임 단위로 필요한 부분만 채택한다. 한 책임 안에서는 키트의 상태 수명·이벤트 처리와 자체 구현을 섞지 않는다. 배치와 디자인은 설치한 복사본에서 바꾸고 공통 동작은 패키지 hook으로 연결한다.

1. 검증된 같은 commit의 패키지 tarball(tgz 압축 파일)과 registry를 선택한다. 발행 전 후보 검사는 저장소의 로컬 산출물을 사용한다.
2. tgz를 `vendor/`에 보관하고 설치한다. 대부분 소스 TS/TSX이므로 Vite/TypeScript가 컴파일하며 Vite에는 `optimizeDeps: { extensions: ['.tsx'] }`를 둔다. Playwright 검사 입구는 Node가 실행할 수 있는 mjs다.

```sh
pnpm add @boosterlab/web-kit@file:vendor/boosterlab-web-kit.tgz
```

3. 소비 프로젝트는 shadcn base-nova(Base UI 기반) 프로젝트여야 한다. 키트 UI는 스스로 모양을 갖지 않고 shadcn 기본 부품(button·input·select·checkbox·dialog·popover·combobox…)과 테마 변수(`bg-background`·`text-muted-foreground`·`border-input`·`ring-ring`·`bg-primary`·`text-destructive` 등)로 그려진다. Tailwind 4와 `shadcn init`이 만든 테마 CSS(`tw-animate-css`·`shadcn/tailwind.css` import와 `:root` 변수), init이 두는 런타임 의존(`@base-ui/react`·`class-variance-authority`·`lucide-react`)이 있어야 한다. 기본 부품 항목은 이 의존을 다시 선언하지 않는다. `components.json`은 아래처럼 `style`을 `base-nova`로, `aliases.ui`(와 `components`)를 `@/shared/ui`로 두고 같은 버전 tag로 고정한 namespace(항목 이름의 출처)를 둔다. `@web-kit/form`은 이 주소의 form.json을 뜻한다. CLI가 별칭을 찾도록 루트 `tsconfig.json`에도 `"paths": { "@/*": ["./src/*"] }`가 있어야 한다.

```json
{
  "style": "base-nova",
  "iconLibrary": "lucide",
  "aliases": { "components": "@/shared/ui", "ui": "@/shared/ui", "utils": "@/shared/lib/utils", "lib": "@/shared/lib", "hooks": "@/shared/lib" },
  "registries": {
    "@web-kit": "https://raw.githubusercontent.com/taehyung-lab/web-kit/<검증한-tag>/public/r/{name}.json"
  }
}
```

설치 결과 폴더는 다음과 같다. shadcn 기본 부품은 프로젝트가 소유하는 shadcn 파일이고, `web-kit/` 아래만 키트 복사본(설치 기록·지문 대상)이다.

| 위치 | 내용 | 출처 |
|---|---|---|
| `src/shared/ui/<부품>.tsx` (예: `button.tsx`·`select.tsx`) | shadcn 기본 부품 | shadcn 공식 registry(키트 항목의 `registryDependencies`로 함께 설치) |
| `src/shared/ui/web-kit/…` | 키트 묶음 부품(Form·List·Record·Dialog·Choice…)과 검사 연결 | `@web-kit` registry |

4. shadcn 4.19.1 CLI로 필요한 항목을 먼저 확인한 뒤 설치한다. 항목은 검사 도구(vitest·Testing Library·Playwright)를 정확한 버전의 devDependencies로 설치해 기존 버전을 바꿀 수 있으므로, `shadcn add --dry-run`으로 바뀔 의존 버전과 lockfile 영향을 먼저 확인한다. 기존 프로젝트는 자기 변경과 차이를 확인한다. `--overwrite`를 갱신 기본값으로 쓰지 않는다.

```sh
pnpm dlx shadcn@4.19.1 add @web-kit/form --dry-run
pnpm dlx shadcn@4.19.1 add @web-kit/form
```

항목의 npm·registry 의존과 단위/브라우저 검사 연결 파일도 함께 설치한다. 항목이 쓰는 shadcn 기본 부품은 shadcn 공식 registry에서 받아 오므로 네트워크가 필요하고, 이미 있는 기본 부품 파일은 덮어쓰기 여부를 묻는다(프로젝트가 고친 부품은 덮어쓰지 않는다). 키트 UI는 `src/shared/ui/web-kit`에 생긴다. 별도 스타일시트는 없으며 앱의 테마 CSS 하나가 모양을 정한다. 예: `@/shared/ui/web-kit/form/ui`의 Form, `@boosterlab/web-kit/form`의 useSaveForm, 화면의 버튼은 `@/shared/ui/button`의 Button.

5. 설치한 버전과 같은 키트 checkout을 지정해 공통 도구로 설치 직후 기록을 만든다. 선택 항목의 내부 의존은 자동으로 포함한다. 원본 정의·빌드 JSON·설치 파일이 맞지 않으면 기록하지 않는다.

```sh
pnpm exec web-kit-registry record --source /path/to/same-version-web-kit --items form
```

프로젝트 루트에서 실행하며 다른 폴더는 `--project apps/admin`으로 지정한다. 원본과 다른 위치로 설치했다면 `--paths paths.json`을 준다. 경로표는 `{"packages/ui-registry/src/form/ui.tsx":"src/components/form.tsx"}`처럼 원본→프로젝트 상대 경로다. 실제 설치 위치가 바뀐 파일을 모두 적는다. 설치 파일을 덮어쓰거나 의존성을 설치하지 않는다.

기록은 프로젝트 루트의 `registry-installation.json`이며 패키지 버전·원본 commit·원본/설치 SHA-256 지문(내용이 같은지 비교하는 값)·CLI 버전·components 설정 지문을 담는다. shadcn은 위의 4.19.1을 사용한다. CLI가 import를 변환하므로 원본과 설치 지문은 별도로 계산한다. `sourceWorkingTree`가 modified면 commit만으로 원본을 식별할 수 없으므로 원본 파일 지문도 보존한다. 같은 버전의 다른 내용으로 정식 재발행하지 않는다. [실제 설치 기록](../references/apps/starter/registry-installation.json)을 참고한다.

6. 설치한 스킬을 링크하고, 함께 설치한 검사 연결을 자기 CI에서 실행한다. [소비 안내](checking.md)의 `web-kit-check`를 필수 단계로 둔다. package.json·lockfile·tgz·복사본·설치 기록·검사 연결을 함께 관리한다.

기록 파일은 프로젝트 루트에 둔다. `--output`으로 이름만 바꿀 수 있으며 하위 폴더는 거절한다. installed 경로는 이 루트 기준으로 쓴다. 새 기록은 schemaVersion 1이며 monorepo의 경로도 그대로 보존한다. 이전 starter 기록의 접두 처리는 구형 기록에서만 유지한다. 원본 commit은 받은 registry의 commit이며 소비 프로젝트의 현재 commit과 혼동하지 않는다. 다른 버전 조합을 검증 없이 섞지 않는다.

### 키트 스타일시트에서 shadcn 기본 부품으로 옮기기

5.0.0-rc.7 후보까지의 복사본은 `ui/styles.css`(`.wk-*` 클래스·`--wk-*` 변수)와 키트 기본 부품(`inputs`)을 썼다. 새 복사본은 shadcn 기본 부품을 조합하고 그 스타일시트를 쓰지 않는다. **복사본 교정과 프로젝트 화면 수정이 모두 필요하다.**

1. 위 3단계대로 base-nova 테마 CSS와 `components.json` 별칭(`aliases.ui: "@/shared/ui"`)을 맞춘다.
2. 새 원본을 설치하고(기본 부품도 함께 설치된다) 설치 기록을 다시 만든다. 지난 복사본의 `ui/styles.css`·`ui/inputs.tsx`·`checks/styles.test.tsx`는 새 원본에 없으므로 지우고, 앱의 `import '@/shared/ui/web-kit/ui/styles.css'`도 지운다.
3. 화면 코드의 기본 부품 import와 속성을 바꾼다.

| 이전 | 이후 |
|---|---|
| `import { Button } from '@/shared/ui/web-kit/ui'` | `import { Button } from '@/shared/ui/button'` |
| `<Button>`(기본 `secondary`) · `variant="primary"` · `"secondary"` · `"ghost"` · `"danger"` | `variant="outline"` · 생략(`default`) · `"outline"` · `"ghost"` · `"destructive"` |
| `Input`·`Checkbox`(`@/shared/ui/web-kit/ui`) | `@/shared/ui/input`·`@/shared/ui/checkbox`(Base UI 속성 그대로) |
| `TextArea`(`@/shared/ui/web-kit/ui`) | `Textarea`(`@/shared/ui/textarea`) |
| `<Select value onChange={(e) => set(e.target.value)}><option value="a">A</option></Select>` | `<Select items={options} value={value} onValueChange={set}><SelectTrigger aria-label="…"><SelectValue placeholder="…" /></SelectTrigger><SelectContent>{options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}</SelectContent></Select>`(`@/shared/ui/select`) |
| `--wk-*` 변수·`.wk-*` 클래스로 바꾼 모양 | 테마 변수(`:root`)나 복사본의 Tailwind 클래스 |

4. 키트 묶음 부품의 props는 그대로다. 그리는 결과만 바뀐다: `Form.Select`·`List.Select`·목록 기간 기준·검색어 대상·정렬·페이지 크기·다운로드 종류는 shadcn Select(역할 `combobox` 버튼과 `option` 목록)다. `Form.Select`는 값이 비었을 때 빈 선택지 대신 안내 문구(`placeholder`, 기본 `messages.choose`)를 트리거에 보인다. 단일 `Choice`의 radio는 칸마다 하나의 radiogroup이다. `Form.Checkbox`는 shadcn Checkbox(button)다. 검사·화면 테스트가 네이티브 `<select>`·`<option>`(예: `selectOptions`)이나 `.wk-*` 클래스를 찾았다면 트리거를 눌러 `option`을 고르는 방식이나 `data-slot`(예: `pending`·`blocking-progress`)으로 바꾼다.
5. 덮개 층은 `z-40`(shadcn 대화창 `z-50` 아래)이다. 층·배경을 바꾸려면 `ui/blocking-progress.tsx` 복사본의 클래스를 고친다(`--wk-blocking-*` 변수는 없다).

### 복사본 갱신

이전 원본 **A**, 받을 새 원본 **B**, 프로젝트가 고친 현재 복사본 **C**를 비교한다. 설치 기록으로 A의 tag/commit과 파일을 찾고 A와 B를 같은 CLI·설정으로 별도 작업 폴더에 설치한다. A→B는 키트 교정, A→C는 프로젝트 수정이다. 두 차이를 비교해 C의 디자인·업무 연결을 보존하며 필요한 교정을 적용한다. 충돌은 파일을 보존해 검토한다. `shadcn add --diff`는 C와 B의 차이만 보여 주므로 세 방향 비교를 대신하지 않는다.

갱신 전에 새 원본으로 변경 요약을 확인한다. 이 단계는 설치된 패키지를 먼저 올릴 필요가 없다.

```sh
pnpm exec web-kit-registry compare --source /path/to/new-web-kit
```

`source`는 키트만, `project`는 프로젝트만, `both`는 양쪽, `added`·`removed`는 원본 파일 추가·제거, `unchanged`는 변경 없음을 뜻한다. `targetChanged`도 확인한다. 이 요약은 원본/설치 지문을 비교하며 위의 같은 CLI·설정으로 만든 A/B/C 실제 diff를 대신하지 않는다. 파일 추가·제거·충돌의 적용은 검토 후 진행한다.

적용 뒤 새 패키지를 설치하고 `web-kit-registry record --source /path/to/new-web-kit --items form --update`로 기록을 갱신한다. 기존 기록은 `--update` 없이 바꾸지 않는다. 설치 항목을 추가했다면 기존 항목까지 모두 지정하고, 제거했다면 실제 사용·검사 연결과 함께 정리한 뒤 기록한다. 같은 단위·브라우저·점검 명령을 다시 실행한다. 되돌릴 때는 이전 tgz·lockfile·복사본·설치 기록을 함께 복원한다. 변경 안내는 매번 **패키지만 올리면 반영 / 복사본 교정 필요**를 구분한다.

## 스킬 연결

프로젝트는 설치본의 스킬을 `.agents/skills/`에 링크하고, 업무 정책 문서와 읽는 순서는 자기 AGENTS.md 지도에 둔다. 키트 문장을 프로젝트 문서에 복사하지 않는다. 링크 기준은 web-kit 의존성을 선언한 패키지의 `node_modules`다(monorepo에서 루트 호이스팅에 기대지 않는다). 예: 저장소 루트에서 `PKG=apps/admin`(단일 패키지면 `PKG=.`).

기능 선택은 [소비 안내의 선택 표](consuming.md#기능을-골라-쓰기)에서 시작한다. 스킬의 예제 링크는 설치 패키지 안의 자동 생성 `references/`로 이어진다. 원본은 실제 starter이며 예제 복사본을 직접 수정하지 않는다. 코드 예제는 읽기용 `.txt`로 담아 검사 러너가 복사본을 실행하지 않게 한다.

기존 코드 교체와 저장 adapter 검사는 [소비 안내](consuming.md)를 따른다.

```sh
mkdir -p .agents/skills
for skill in "$PKG"/node_modules/@boosterlab/web-kit/skills/web-kit-*; do
  [ -f "$skill/SKILL.md" ] || continue
  name="${skill##*/}"
  link=".agents/skills/$name"
  if [ -e "$link" ] || [ -L "$link" ]; then
    printf '%s\n' "기존 경로를 확인하세요: $link" >&2
    continue
  fi
  ln -s "../../$PKG/node_modules/@boosterlab/web-kit/skills/$name" "$link"
done
```

기존 같은 이름의 스킬이 있으면 덮어쓰지 않고 출처를 확인한다. 업그레이드 뒤 링크가 설치한 버전의 `SKILL.md`로 해소되는지 확인한다. 프로젝트 역할 스킬은 반복되는 제품 고유 판단이 있을 때만 둔다. 공통 조립법은 키트 스킬이 맡고 제품 근거·검사 위치는 프로젝트 지도에서 찾는다.
