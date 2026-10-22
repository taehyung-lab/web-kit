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
import { StrictMode } from "react";
import { useSubmissionLifecycle } from "../src/useSubmissionLifecycle";
import { useConfirmationState } from "../src/confirmation";
import { FieldFrame } from "../src/form-ui";
import { activateTableRow } from "../src/row-activation";

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

it("locks before validation yields and releases after rejection", async () => {
  const { result } = renderHook(useSubmissionLifecycle, {
    wrapper: StrictMode,
  });
  let reject!: (reason: Error) => void;
  const save = vi.fn(
    () =>
      new Promise<void>((_, failure) => {
        reject = failure;
      }),
  );
  const first = result.current.run(save);
  const observed = expect(first).rejects.toThrow("failed");
  await result.current.run(save);
  expect(save).toHaveBeenCalledTimes(1);
  reject(new Error("failed"));
  await observed;
  const retry = vi.fn();
  await result.current.run(retry);
  expect(retry).toHaveBeenCalledTimes(1);
});

it("only the last focus runs; cancellation and unmount prevent stale focus", () => {
  vi.useFakeTimers();
  const { result, unmount } = renderHook(useSubmissionLifecycle, {
    wrapper: StrictMode,
  });
  const first = document.createElement("input");
  const second = document.createElement("input");
  document.body.append(first, second);
  result.current.scheduleFocus(() => first.focus());
  result.current.scheduleFocus(() => second.focus());
  act(() => vi.runAllTimers());
  expect(document.activeElement).toBe(second);
  result.current.scheduleFocus(() => first.focus());
  result.current.cancelFocus();
  act(() => vi.runAllTimers());
  expect(document.activeElement).toBe(second);
  result.current.scheduleFocus(() => first.focus());
  unmount();
  act(() => vi.runAllTimers());
  expect(document.activeElement).toBe(second);
  first.remove();
  second.remove();
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
