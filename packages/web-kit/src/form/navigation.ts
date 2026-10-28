/** 폼 범위와 이탈 요청 하나의 수명을 소유한다. Router와 UI는 이 판정을 소비한다. */
/** 이탈을 묻는 까닭. 문구만 다르고 판정은 같다(취소 버튼 / 그 밖의 이동·닫기). */
export type LeaveReason = 'navigate' | 'cancel';
export interface FormFacts {
  readonly dirty: boolean;
  readonly busy: boolean;
  readonly identity: unknown;
}
type Action = () => void | Promise<void>;
type Owner = { readonly scope?: object; readonly read: () => FormFacts };
type Pending = {
  readonly scope?: object;
  readonly owners: ReadonlyMap<object, unknown>;
  readonly run: Action;
  readonly cancel?: () => void;
  readonly reason: LeaveReason;
};

/** 기본 이탈 판정. 등록 정보는 복사한 dirty가 아니라 현재 상태를 읽는 함수다. */
export function createFormNavigation() {
  const owners = new Map<object, Owner>();
  const scopes = new Map<object, object | undefined>();
  const listeners = new Set<() => void>();
  let pending: Pending | undefined;
  let failure: unknown;
  let confirmationOwner: object | undefined;
  let revision = 0;
  /** 구독자에게 확인 상태의 변화를 알린다. */
  function publish() {
    revision++;
    for (const listener of [...listeners]) listener();
  }
  /** 해당 범위와 자식 범위에 속한 폼인지 판단한다. */
  function includes(child: object | undefined, parent: object | undefined): boolean {
    if (parent === undefined) return true;
    while (child !== undefined) {
      if (child === parent) return true;
      child = scopes.get(child);
    }
    return false;
  }
  /** 현재 범위의 사실만 모은다. */
  function facts(scope?: object) {
    return [...owners].filter(([, owner]) => includes(owner.scope, scope)).map(([id, owner]) => [id, owner.read()] as const);
  }
  /** 미결 요청을 취소하고 Router의 보류도 해제한다. */
  function cancel() {
    const previous = pending;
    pending = undefined;
    previous?.cancel?.();
    publish();
  }
  /** 확인 당시 폼 수명이 바뀌거나 저장이 시작되면 이전 허가를 폐기한다. */
  function valid(request: Pending) {
    if (request.scope !== undefined && !scopes.has(request.scope)) return false;
    const current = facts(request.scope);
    return (
      current.length === request.owners.size &&
      current.every(([id, value]) => request.owners.has(id) && Object.is(request.owners.get(id), value.identity) && !value.busy)
    );
  }
  /** 완료 동작의 실패를 저장 실패와 분리하여 노출한다. */
  function perform(action: Action) {
    try {
      Promise.resolve(action()).catch((error) => {
        failure = error;
        publish();
      });
    } catch (error) {
      failure = error;
      publish();
    }
  }
  /** 이동·닫기 의도를 최신 상태로 판정한다. 동시에 두 요청을 예약하지 않는다. */
  function request(
    run: Action,
    { scope, onCancel, reason = 'navigate' }: { readonly scope?: object; readonly onCancel?: () => void; readonly reason?: LeaveReason } = {},
  ): 'performed' | 'confirming' | 'blocked' {
    if (pending !== undefined || (scope !== undefined && !scopes.has(scope))) return 'blocked';
    const current = facts(scope);
    if (current.some(([, value]) => value.busy)) return 'blocked';
    failure = undefined;
    if (!current.some(([, value]) => value.dirty)) {
      perform(run);
      return 'performed';
    }
    pending = { scope, owners: new Map(current.map(([id, value]) => [id, value.identity])), run, cancel: onCancel, reason };
    publish();
    return 'confirming';
  }
  /** 승인 한 번은 현재 요청 한 번에만 적용한다. */
  function confirm() {
    const previous = pending;
    if (previous === undefined) return;
    if (!valid(previous)) {
      cancel();
      return;
    }
    pending = undefined;
    publish();
    perform(previous.run);
  }
  /** 입력 상태가 바뀔 때 보류 요청과 브라우저 이탈 상태를 갱신한다. */
  function changed() {
    if (pending !== undefined && !valid(pending)) cancel();
    else publish();
  }
  return {
    register(id: object, owner: Owner) {
      owners.set(id, owner);
      changed();
      return () => {
        owners.delete(id);
        changed();
      };
    },
    registerScope(id: object, parent?: object) {
      scopes.set(id, parent);
      return () => {
        scopes.delete(id);
        changed();
      };
    },
    changed,
    request,
    confirm,
    cancel,
    /** 저장 확인창도 앱에서 하나만 소유한다. */
    claimConfirmation(id: object) {
      if (pending !== undefined || (confirmationOwner !== undefined && confirmationOwner !== id)) return false;
      if (confirmationOwner !== id) {
        confirmationOwner = id;
        publish();
      }
      return true;
    },
    releaseConfirmation(id: object) {
      if (confirmationOwner === id) {
        confirmationOwner = undefined;
        publish();
      }
    },
    get confirmationOwner() {
      return confirmationOwner;
    },
    blocked: (scope?: object) => facts(scope).some(([, value]) => value.dirty || value.busy),
    busy: (scope?: object) => facts(scope).some(([, value]) => value.busy),
    get pending() {
      return pending !== undefined;
    },
    /** 지금 묻는 이탈의 까닭. 묻는 중이 아니면 undefined. */
    get reason() {
      return pending?.reason;
    },
    get failure() {
      return failure;
    },
    getSnapshot: () => revision,
    subscribe(listener: () => void) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    },
  };
}
export type FormNavigation = ReturnType<typeof createFormNavigation>;
