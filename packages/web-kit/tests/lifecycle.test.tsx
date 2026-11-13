// @vitest-environment jsdom
/** 공통 실행 수명과 실제 입력/오류 DOM의 관찰 검사. */
import {
  act,
  cleanup,
  fireEvent,
  render,
  renderHook,
  screen,
} from "@testing-library/react";
import { afterEach, expect, it, vi } from "vitest";
import { useConfirmationState } from "../src/confirmation";
import { FieldFrame } from "../../ui-registry/src/form/field";
import { activateTableRow } from "../src/row-activation";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("confirmation holds its target while pending, shows rejection and allows retry", async () => {
  let reject!: (reason: string) => void;
  const run = vi.fn(
    (_value: string) =>
      new Promise<void>((_, fail) => {
        reject = fail;
      }),
  );
  const { result } = renderHook(() =>
    useConfirmationState({
      run,
      onError: (error) => ({ kind: "show", failure: String(error) }),
    }),
  );
  act(() => result.current.request("A"));
  let task!: Promise<void>;
  act(() => {
    task = result.current.confirm();
    void result.current.confirm();
    result.current.close();
    result.current.request("B");
  });
  expect(run.mock.calls).toEqual([["A"]]);
  expect(result.current.state).toMatchObject({
    kind: "open",
    values: "A",
    pending: true,
  });
  await act(async () => {
    reject("failed");
    await task;
  });
  expect(result.current.state).toMatchObject({
    kind: "open",
    values: "A",
    pending: false,
    failure: "failed",
  });
  run.mockResolvedValueOnce();
  await act(async () => {
    await result.current.confirm();
  });
  expect(result.current.state).toEqual({ kind: "closed" });
});

it("delegated errors close and unmounted completion does not classify failure", async () => {
  const delegated = renderHook(() =>
    useConfirmationState({
      run: () => Promise.reject("401"),
      onError: () => ({ kind: "close" }),
    }),
  );
  act(() => delegated.result.current.request(undefined));
  await act(async () => {
    await delegated.result.current.confirm();
  });
  expect(delegated.result.current.state.kind).toBe("closed");
  let reject!: () => void;
  const onError = vi.fn(() => ({ kind: "close" as const }));
  const hook = renderHook(() =>
    useConfirmationState({
      run: () =>
        new Promise<void>((_, fail) => {
          reject = () => fail("late");
        }),
      onError,
    }),
  );
  act(() => hook.result.current.request(undefined));
  let task!: Promise<void>;
  act(() => {
    task = hook.result.current.confirm();
  });
  hook.unmount();
  await act(async () => {
    reject();
    await task;
  });
  expect(onError).not.toHaveBeenCalled();
});

it("field label, description and alert refer to the same control and clear together", () => {
  const classes = {
    root: "",
    label: "",
    required: "",
    description: "",
    error: "",
  };
  const view = (message?: string) => (
    <FieldFrame
      id="one"
      label="Name"
      description="Help"
      required
      classes={classes}
      message={message}
    >
      {(props) => <input {...props} />}
    </FieldFrame>
  );
  const { rerender } = render(view("Invalid"));
  const input = screen.getByRole("textbox", { name: "Name" });
  expect(input.getAttribute("aria-describedby")).toBe(
    "one-description one-error",
  );
  expect(input.getAttribute("aria-invalid")).toBe("true");
  expect(screen.getByRole("alert").id).toBe("one-error");
  rerender(view());
  expect(input.getAttribute("aria-describedby")).toBe("one-description");
  expect(input.getAttribute("aria-invalid")).toBe("false");
  expect(screen.queryByRole("alert")).toBeNull();
});

it("table row activates with configured keys and leaves nested controls alone", () => {
  const activate = vi.fn();
  const policy = { keys: ["Enter"], interactiveSelector: "button,input" };
  render(
    <table>
      <tbody>
        <tr
          tabIndex={0}
          onClick={(event) => activateTableRow(event, activate, policy)}
          onKeyDown={(event) => activateTableRow(event, activate, policy)}
        >
          <td>
            Row<button>Action</button>
          </td>
        </tr>
      </tbody>
    </table>,
  );
  const row = screen.getByRole("row");
  fireEvent.click(row);
  fireEvent.keyDown(row, { key: "Enter" });
  fireEvent.keyDown(row, { key: " " });
  fireEvent.click(screen.getByRole("button"));
  fireEvent.keyDown(screen.getByRole("button"), { key: "Enter" });
  expect(activate).toHaveBeenCalledTimes(2);
});

it("retries completion without repeating a committed request", async () => {
  const run = vi.fn(async (_id: number) => "saved");
  const onSuccess = vi
    .fn()
    .mockRejectedValueOnce(new Error("navigation failed"))
    .mockResolvedValueOnce(undefined);
  const { result } = renderHook(() =>
    useConfirmationState({
      run,
      onSuccess,
      onError: (failure: unknown) => ({ kind: "show", failure }),
    }),
  );
  act(() => result.current.request(1));
  await act(async () => {
    await result.current.confirm();
  });
  expect(result.current.state).toMatchObject({
    kind: "open",
    completed: true,
    pending: false,
  });
  await act(async () => {
    await result.current.confirm();
  });
  expect(run).toHaveBeenCalledTimes(1);
  expect(onSuccess).toHaveBeenCalledTimes(2);
  expect(result.current.state.kind).toBe("closed");
});

it("invalidates an open confirmation and late completion when identity changes", async () => {
  let resolve!: () => void;
  const onSuccess = vi.fn();
  const run = vi.fn(
    () =>
      new Promise<void>((done) => {
        resolve = done;
      }),
  );
  const { result, rerender } = renderHook(
    ({ identity }) =>
      useConfirmationState({
        identity,
        run,
        onSuccess,
        onError: (failure: unknown) => ({ kind: "show", failure }),
      }),
    { initialProps: { identity: 1 } },
  );
  act(() => result.current.request(1));
  rerender({ identity: 2 });
  expect(result.current.state.kind).toBe("closed");
  await act(async () => {
    await result.current.confirm();
  });
  expect(run).not.toHaveBeenCalled();
  act(() => result.current.request(2));
  let task!: Promise<void>;
  act(() => {
    task = result.current.confirm();
  });
  rerender({ identity: 3 });
  await act(async () => {
    resolve();
    await task;
  });
  expect(onSuccess).not.toHaveBeenCalled();
  expect(result.current.state.kind).toBe("closed");
});

it("does not start success effects after unmount and exposes invalidation across a success await", async () => {
  let resolve!: () => void;
  const completed = new Promise<void>((done) => {
    resolve = done;
  });
  const effect = vi.fn();
  const started = vi.fn();
  const hook = renderHook(() =>
    useConfirmationState({
      run: async () => undefined,
      onSuccess: async (_result, { isCurrent }) => {
        started();
        await completed;
        if (isCurrent()) effect();
      },
      onError: () => ({ kind: "close" }),
    }),
  );
  act(() => hook.result.current.request(undefined));
  let task!: Promise<void>;
  await act(async () => {
    task = hook.result.current.confirm();
    await Promise.resolve();
  });
  expect(started).toHaveBeenCalledTimes(1);
  hook.unmount();
  await act(async () => {
    resolve();
    await task;
  });
  expect(effect).not.toHaveBeenCalled();
});

it("uses dialog progress rather than a deletion cover when retrying only completion", async () => {
  let finish!: () => void;
  const onSuccess = vi
    .fn()
    .mockRejectedValueOnce(new Error("followup"))
    .mockImplementationOnce(
      () =>
        new Promise<void>((done) => {
          finish = done;
        }),
    );
  const hook = renderHook(() =>
    useConfirmationState({
      progress: "delete",
      run: async () => undefined,
      onSuccess,
      onError: (failure) => ({ kind: "show", failure }),
    }),
  );
  act(() => hook.result.current.request(undefined));
  await act(async () => {
    await hook.result.current.confirm();
  });
  let task!: Promise<void>;
  act(() => {
    task = hook.result.current.confirm();
  });
  expect(hook.result.current.state).toMatchObject({
    kind: "open",
    completed: true,
    pending: true,
  });
  expect(hook.result.current.covered).toBe(false);
  await act(async () => {
    finish();
    await task;
  });
});

it("keeps successful request results across closing and reopening completion failures for the same target", async () => {
  const run = vi.fn(async (id: number) => id);
  const onSuccess = vi
    .fn()
    .mockRejectedValueOnce(new Error("navigation"))
    .mockResolvedValueOnce(undefined);
  const hook = renderHook(() =>
    useConfirmationState({
      identity: 1,
      run,
      onSuccess,
      onError: (failure) => ({ kind: "show", failure }),
    }),
  );
  act(() => hook.result.current.request(1));
  await act(async () => {
    await hook.result.current.confirm();
  });
  act(() => hook.result.current.close());
  act(() => hook.result.current.request(1));
  expect(hook.result.current.state).toMatchObject({
    kind: "open",
    completed: true,
  });
  await act(async () => {
    await hook.result.current.confirm();
  });
  expect(run).toHaveBeenCalledTimes(1);
  expect(onSuccess).toHaveBeenCalledTimes(2);
});
