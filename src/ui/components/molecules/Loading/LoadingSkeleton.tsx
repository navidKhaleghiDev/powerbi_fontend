import type { PropsWithChildren } from "react";

interface PropsType extends PropsWithChildren {
  isLoading?: boolean;
  className?: string;
  count?: number;
  classNameContainer?: string;
}

/**
 * LoadingSkelton Component
 *
 * A simple loading skeleton that conditionally renders a pulsing placeholder
 * or the actual content (children).
 *
 * When `isLoading` is true, it shows a full-size gray pulsing block.
 * When `isLoading` is false (or undefined), it renders the provided `children`.
 *
 * @param {PropsType} props - Component props
 * @param {boolean} [props.isLoading=false] - Controls whether to show the skeleton
 * @param {React.ReactNode} props.children - The real content to show when not loading
 * @param {string} [props.className] - Extra Tailwind/utility classes for the skeleton block
 * @returns {JSX.Element} Either the skeleton placeholder or the children
 */

export function LoadingSkelton({ isLoading, children, className }: PropsType) {
  if (isLoading) {
    return (
      <div
        className={`animate-pulse bg-gray-200 dark:bg-gray-800 size-full rounded-2xl ${className ?? ""}`}
      />
    );
  }
  return children;
}

/**
 * Skeleton Component
 *
 * A reusable standalone skeleton placeholder.
 * Useful when you need a static skeleton without conditional logic.
 *
 * @param {Object} props - Component props
 * @param {string} [props.className] - Extra Tailwind/utility classes for the skeleton block
 * @returns {JSX.Element} A pulsing gray block
 */

export function Skeleton({ className }: { className: PropsType["className"] }) {
  return (
    <div
      className={`animate-pulse bg-gray-200 dark:bg-gray-800 size-full rounded-2xl ${className ?? ""}`}
    />
  );
}

/**
 * LoadingSkeltonItems Component
 *
 * Renders multiple skeleton items when loading, or the real content when not.
 * Ideal for lists, grids, or any repeated content that needs skeleton placeholders.
 *
 * @param {PropsType} props - Component props
 * @param {boolean} [props.isLoading=false] - Controls whether to show skeletons
 * @param {React.ReactNode} props.children - The actual list/content to render when loaded
 * @param {string} [props.className] - Classes applied to each individual skeleton item
 * @param {string} [props.classNameContainer] - Classes for the wrapper div around all skeleton items
 * @param {number} [props.count=1] - How many skeleton items to generate
 * @returns {JSX.Element} Either a list of skeleton items or the children
 */

export function LoadingSkeltonItems({
  isLoading,
  children,
  className,
  classNameContainer,
  count = 1,
}: PropsType) {
  const items = Array.from({ length: count }, (_, index) => (
    <div
      key={index}
      className={`animate-pulse bg-gray-200 dark:bg-gray-800 size-full rounded-2xl ${className ?? ""}`}
    />
  ));

  if (isLoading) {
    return <div className={classNameContainer}>{items}</div>;
  }
  return children;
}
