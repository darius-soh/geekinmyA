import { forwardRef } from 'react';

function joinClasses(...values) {
  return values.filter(Boolean).join(' ');
}

export const InteractiveHoverButton = forwardRef(function InteractiveHoverButton(
  {
    as: Component = 'button',
    borderRadius = '1.25rem',
    className = '',
    contentClassName = '',
    contentStyle,
    style,
    type,
    disabled = false,
    text,
    children,
    ...props
  },
  ref
) {
  const staticContent = typeof text === 'string' && text.trim()
    ? text.trim()
    : children;
  const resolvedType = Component === 'button' ? (type || 'button') : undefined;
  const ariaLabel = props['aria-label'];

  return (
    <Component
      ref={ref}
      className={joinClasses('moving-border-button', disabled && 'is-disabled', className)}
      style={{
        '--moving-border-radius': borderRadius,
        ...style,
      }}
      type={resolvedType}
      disabled={Component === 'button' ? disabled : undefined}
      aria-disabled={Component !== 'button' && disabled ? true : undefined}
      aria-label={ariaLabel}
      {...props}
    >
      <span
        className={joinClasses('moving-border-button__content', contentClassName)}
        style={contentStyle}
      >
        {staticContent}
      </span>
    </Component>
  );
});

InteractiveHoverButton.displayName = 'InteractiveHoverButton';

export default InteractiveHoverButton;
