import type { ComponentType, TextareaHTMLAttributes } from "react";

type TextAreaProps = TextareaHTMLAttributes<HTMLTextAreaElement>;

// Swagger UI's request body box in Try it out is a <textarea> with no label,
// which fails WCAG 2.1 "label" (#16). This plugin wraps Swagger UI's TextArea
// and names that box, leaving any other textarea and any name it already has
// alone.
export const requestBodyLabel = {
  wrapComponents: {
    TextArea: (Original: ComponentType<TextAreaProps>) =>
      function LabelledTextArea(props: TextAreaProps) {
        const isRequestBody =
          props.className?.split(" ").includes("body-param__text") ?? false;
        return (
          <Original
            aria-label={isRequestBody ? "Request body" : undefined}
            {...props}
          />
        );
      },
  },
};
