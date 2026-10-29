// 파일 책임: 필드 라벨·설명·오류의 배치를 제공하고 패키지 접근성 연결을 사용한다.
/** 필드의 라벨·설명·오류 접근성 구조를 렌더한다. 번역·필수 판정·스타일은 소비자가 제공한다. */
import type { ReactNode } from "react";
import { formFieldFeedback } from "@boosterlab/web-kit/form";

export interface FieldControlProps {
  readonly id: string;
  readonly "aria-describedby"?: string;
  readonly "aria-invalid": boolean;
}

/** 설명과 첫 표시 오류를 입력에 연결하고 오류 슬롯을 제공한다. */
export function FieldFeedback({
  id,
  message,
  describedBy = [],
  errorClassName,
  children,
}: {
  readonly id: string;
  readonly message?: string;
  readonly describedBy?: readonly string[];
  readonly errorClassName: string;
  readonly children: (
    control: FieldControlProps,
    error: ReactNode,
  ) => ReactNode;
}) {
  const { errorId, control } = formFieldFeedback(id, message, describedBy);
  return children(
    control,
    message === undefined ? null : (
      <p id={errorId} role="alert" className={errorClassName}>
        {message}
      </p>
    ),
  );
}

/** 단일 입력/묶음 라벨과 설명 위치를 유지하면서 공통 오류 슬롯으로 연결한다. */
export function FieldFrame({
  id,
  label,
  required,
  description,
  descriptionPosition = "afterControl",
  labelTarget = "control",
  message,
  classes,
  children,
}: {
  readonly id: string;
  readonly label: string;
  readonly required: boolean;
  readonly description?: string;
  readonly descriptionPosition?: "afterLabel" | "afterControl";
  readonly labelTarget?: "control" | "group";
  readonly message?: string;
  readonly classes: {
    readonly root: string;
    readonly label: string;
    readonly required: string;
    readonly description: string;
    readonly error: string;
  };
  readonly children: (control: FieldControlProps, labelId: string) => ReactNode;
}) {
  const labelId = `${id}-label`;
  const descriptionId =
    description === undefined ? undefined : `${id}-description`;
  const labelText = (
    <>
      {label}
      {required ? (
        <span aria-hidden="true" className={classes.required}>
          *
        </span>
      ) : null}
    </>
  );
  const descriptionNode =
    description === undefined ? null : (
      <p id={descriptionId} className={classes.description}>
        {description}
      </p>
    );
  return (
    <FieldFeedback
      id={id}
      message={message}
      describedBy={descriptionId === undefined ? [] : [descriptionId]}
      errorClassName={classes.error}
    >
      {(control, error) => (
        <div className={classes.root}>
          {labelTarget === "group" ? (
            <span id={labelId} className={classes.label}>
              {labelText}
            </span>
          ) : (
            <label id={labelId} className={classes.label} htmlFor={id}>
              {labelText}
            </label>
          )}
          {descriptionPosition === "afterLabel" ? descriptionNode : null}
          {children(control, labelId)}
          {descriptionPosition === "afterControl" ? descriptionNode : null}
          {error}
        </div>
      )}
    </FieldFeedback>
  );
}
