// 파일 책임: 공유하는 선택 값과 트리를 여러 입력 모양 및 서버 검색에 연결한다.
// 입력 모양(체크박스·라디오·팝오버·메뉴·콤보박스)은 프로젝트의 shadcn 기본 부품이 정하고, 여기서는 값·트리·검색 연결과 배치만 맡는다.
import type { ComponentProps, ReactNode } from 'react';
import { cn } from 'cn';
import { ChevronDownIcon } from 'lucide-react';
import { useChoiceBinding, type ChoiceBindingOptions, type ChoiceNode as ChoiceBindingNode, type ChoiceValue } from '@boosterlab/web-kit/choice';
import { treeLeaves, treeLeafNodes } from '@boosterlab/web-kit';
import { Button } from '@/components/ui/button';
import { Checkbox } from '@/components/ui/checkbox';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Combobox, ComboboxCollection, ComboboxContent, ComboboxEmpty, ComboboxGroup, ComboboxInput, ComboboxItem, ComboboxLabel, ComboboxList, ComboboxTrigger } from '@/components/ui/combobox';
import { InputGroupAddon, InputGroupButton } from '@/components/ui/input-group';

export type ChoiceNode = ChoiceBindingNode;
export type { ChoiceValue };
/** 동작 입력(값·트리·검색·접근성)은 패키지의 ChoiceBindingOptions가 소유하고, 여기서는 모양 선택만 더한다. */
export interface ChoiceProps extends ChoiceBindingOptions {
  readonly appearance?: 'vertical' | 'horizontal' | 'dropdown' | 'menu' | 'search';
}

/**
 * 일부 선택(indeterminate)을 체크와 다르게 보이는 체크박스. shadcn Checkbox는 일부 선택에도 체크 표시를 그리므로
 * 그 상태에서만 표시를 가로줄로 바꾼다(색은 테마 토큰). 목록 선택 열도 같은 부품을 쓴다.
 */
export function MixedCheckbox({ className, ...props }: ComponentProps<typeof Checkbox>) {
  return (
    <Checkbox
      {...props}
      className={cn(
        'data-indeterminate:border-primary data-indeterminate:bg-primary data-indeterminate:text-primary-foreground data-indeterminate:[&_svg]:hidden data-indeterminate:before:h-0.5 data-indeterminate:before:w-2 data-indeterminate:before:rounded-full data-indeterminate:before:bg-current',
        className,
      )}
    />
  );
}

type Leaf = { readonly value: string; readonly label: string };
/** 가지 하나의 제목과 체크. targets는 그 가지 아래 모든 leaf다. */
type BranchHead = { readonly label: string; readonly depth: number; readonly targets: readonly string[] };
/** 검색 상자의 한 묶음: 목록에 보이는 leaf 줄(items)과, 그 앞에 그리는 가지 제목들(heads). */
type LeafGroup = { readonly heads: readonly BranchHead[]; readonly items: readonly Leaf[] };

/** 가지 하나와 그 아래 가지를 위에서 아래 순서로 묶는다. items가 비어 있을 수 있다. */
function branchGroups(node: Extract<ChoiceNode, { children: readonly ChoiceNode[] }>, depth: number): LeafGroup[] {
  const own: Leaf[] = [];
  const below: LeafGroup[] = [];
  for (const child of node.children) {
    if (child.children === undefined) own.push({ value: child.value, label: child.label });
    else below.push(...branchGroups(child, depth + 1));
  }
  return [{ heads: [{ label: node.label, depth, targets: treeLeaves(node.children) }], items: own }, ...below];
}

/**
 * 검색 상자용 묶음. 바로 달린 leaf가 없는 가지(상위만 있는 가지)의 제목과 체크는 다음 묶음의 앞에 이어 그려
 * 콤보박스가 빈 묶음을 감춰도 사라지지 않는다. 맨 위의 leaf는 제목 없는 묶음이다.
 */
function leafGroups(nodes: readonly ChoiceNode[]): LeafGroup[] {
  const top = nodes.filter((node) => node.children === undefined).map((node) => ({ value: node.value as string, label: node.label }));
  const raw = [
    ...(top.length > 0 ? [{ heads: [] as BranchHead[], items: top }] : []),
    ...nodes.flatMap((node) => (node.children === undefined ? [] : branchGroups(node, 0))),
  ];
  const groups: LeafGroup[] = [];
  let pending: BranchHead[] = [];
  for (const group of raw) {
    if (group.items.length === 0) pending = [...pending, ...group.heads];
    else {
      groups.push({ heads: [...pending, ...group.heads], items: group.items });
      pending = [];
    }
  }
  return groups;
}

/** 같은 leaf 값 모델을 모든 모양에서 사용한다. 가지 ID는 저장하지 않는다. */
export function Choice(props: ChoiceProps) {
  const { nodes, multiple = false, appearance = 'dropdown', disabled, label } = props;
  const { id, text, setText, result, selected, names, summary, control, selection, toggle, toggleGroup, groupState, select } = useChoiceBinding(props);
  /** 다중 가지는 삼상태, 단일 가지는 제목으로만 보여 준다. */
  function branch(node: ChoiceNode, key: number): ReactNode {
    const targets = node.children === undefined ? [node.value] : treeLeaves(node.children);

    return (
      <li key={node.value ?? key} className="grid gap-2">
        {multiple ? (
          <label className="flex items-center gap-2 text-sm">
            <MixedCheckbox
              disabled={disabled}
              checked={selection.checked(targets)}
              indeterminate={selection.mixed(targets)}
              onCheckedChange={() => toggle(targets)}
            />
            {node.label}
          </label>
        ) : node.children !== undefined ? (
          <span className="text-sm font-medium">{node.label}</span>
        ) : (
          <label className="flex items-center gap-2 text-sm">
            <RadioGroupItem value={node.value} disabled={disabled} />
            {node.label}
          </label>
        )}
        {node.children !== undefined && <ul className="grid gap-2 pl-6">{node.children.map(branch)}</ul>}
      </li>
    );
  }
  const clear =
    !multiple && props.clearLabel !== undefined && selected.length > 0 ? (
      <Button type="button" variant="ghost" size="sm" disabled={disabled} onClick={() => select(undefined)}>
        {props.clearLabel}
      </Button>
    ) : null;
  const list = (
    <ul className={appearance === 'horizontal' ? 'flex flex-wrap items-center gap-x-4 gap-y-2' : 'grid gap-2'}>
      {(props.allLabel === undefined || !multiple ? nodes : [{ label: props.allLabel, children: nodes }]).map(branch)}
    </ul>
  );
  // 단일 선택은 라디오 묶음 하나로 같은 칸의 라디오만 서로 배타가 된다(id를 묶음 이름으로 쓴다).
  const tree = (
    <>
      {clear === null ? null : <div>{clear}</div>}
      {multiple ? (
        list
      ) : (
        <RadioGroup name={id} value={selected[0] ?? null} onValueChange={(value) => select(value as string)} disabled={disabled} className="block w-auto">
          {list}
        </RadioGroup>
      )}
    </>
  );
  /** 단일 계층 메뉴는 가지를 열고 맨 아래 값만 선택한다. */
  function menu(node: ChoiceNode, key: number): ReactNode {
    return node.children === undefined ? (
      <DropdownMenuItem disabled={disabled} key={node.value} onClick={() => select(node.value)}>
        {node.label}
      </DropdownMenuItem>
    ) : (
      <DropdownMenuSub key={key}>
        <DropdownMenuSubTrigger disabled={disabled}>{node.label}</DropdownMenuSubTrigger>
        <DropdownMenuSubContent>{node.children.map(menu)}</DropdownMenuSubContent>
      </DropdownMenuSub>
    );
  }
  /** 팝업을 여는 버튼 모양. 내용은 지금 고른 값 요약이고 이름은 control의 aria-label이 맡는다. */
  const triggerButton = <Button variant="outline" className="min-w-36 justify-between font-normal" />;
  if (appearance === 'search') {
    const leaves = treeLeafNodes(result.nodes);
    const grouped = result.nodes.some((node) => node.children !== undefined);
    const items = grouped ? leafGroups(result.nodes) : leaves;
    const selectedItems = selected.map((id) => ({ value: id, label: names.current.get(id) ?? id }));
    const common = {
      disabled,
      items,
      inputValue: text,
      onInputValueChange: setText,
      filter: props.search === undefined ? undefined : null,
      isItemEqualToValue: (a: { value: string }, b: { value: string }) => a.value === b.value,
    };
    const parts = (
      <div className="flex flex-wrap items-center gap-2">
        <ComboboxInput {...control} showTrigger={false} disabled={disabled}>
          <InputGroupAddon align="inline-end">
            <InputGroupButton size="icon-xs" variant="ghost" render={<ComboboxTrigger aria-label={label} />} disabled={disabled} />
          </InputGroupAddon>
        </ComboboxInput>
        <span aria-live="polite" className="text-sm text-muted-foreground">
          {summary}
        </span>
        {clear}
        <ComboboxContent>
          {result.pending && (
            <p role="status" className="px-2 py-1.5 text-sm text-muted-foreground">
              {props.messages?.loading ?? '불러오는 중입니다.'}
            </p>
          )}
          {result.failed && (
            <div role="alert" className="flex items-center gap-2 px-2 py-1.5 text-sm text-destructive">
              {props.messages?.failed ?? '선택지를 불러오지 못했습니다.'}
              <Button type="button" variant="outline" size="sm" onClick={result.retry}>
                {props.messages?.retry ?? '다시 시도'}
              </Button>
            </div>
          )}
          <ComboboxEmpty>{props.messages?.empty ?? '선택지가 없습니다.'}</ComboboxEmpty>
          <ComboboxList>
            {grouped
              ? (group: LeafGroup) => (
                  <ComboboxGroup key={`${group.heads.map((head) => head.label).join('/')}:${group.items[0]?.value ?? ''}`} items={group.items}>
                    {group.heads.map((head) => {
                      const state = groupState(head.targets);
                      return (
                        <ComboboxLabel key={`${head.depth}:${head.label}`} className="flex items-center gap-2" style={{ paddingInlineStart: `${head.depth}rem` }}>
                          {multiple && (
                            <MixedCheckbox
                              aria-label={head.label}
                              disabled={disabled}
                              checked={state.checked}
                              indeterminate={state.mixed}
                              onCheckedChange={() => toggleGroup(head.targets)}
                            />
                          )}
                          {head.label}
                        </ComboboxLabel>
                      );
                    })}
                    <ComboboxCollection>
                      {(item: Leaf) => (
                        <ComboboxItem key={item.value} value={item}>
                          {item.label}
                        </ComboboxItem>
                      )}
                    </ComboboxCollection>
                  </ComboboxGroup>
                )
              : (item: Leaf) => (
                  <ComboboxItem key={item.value} value={item}>
                    {item.label}
                  </ComboboxItem>
                )}
          </ComboboxList>
        </ComboboxContent>
      </div>
    );
    return multiple ? (
      <Combobox {...common} multiple value={selectedItems} onValueChange={(items) => select(items.map((item) => item.value))}>
        {parts}
      </Combobox>
    ) : (
      <Combobox {...common} value={selectedItems[0] ?? null} onValueChange={(item) => select(item?.value)}>
        {parts}
      </Combobox>
    );
  }
  if (appearance === 'menu' && !multiple)
    return (
      <DropdownMenu>
        <DropdownMenuTrigger {...control} render={triggerButton}>
          {summary}
          <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
        </DropdownMenuTrigger>
        <DropdownMenuContent className="w-auto">
          {!multiple && props.clearLabel !== undefined && selected.length > 0 && (
            <DropdownMenuItem disabled={disabled} onClick={() => select(undefined)}>
              {props.clearLabel}
            </DropdownMenuItem>
          )}
          {nodes.map(menu)}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  if (appearance === 'dropdown' || appearance === 'menu')
    return (
      <Popover>
        <PopoverTrigger {...control} render={triggerButton}>
          {summary}
          <ChevronDownIcon aria-hidden="true" className="text-muted-foreground" />
        </PopoverTrigger>
        <PopoverContent aria-label={label} align="start" className="max-h-96 w-auto min-w-(--anchor-width) overflow-auto">
          {tree}
        </PopoverContent>
      </Popover>
    );
  return (
    <div {...control} role="group" tabIndex={-1} className="grid gap-2 outline-none">
      {tree}
    </div>
  );
}
