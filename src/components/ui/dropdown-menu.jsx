import React, { useState, useRef, useEffect } from "react";

const DropdownMenu = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (containerRef.current && !containerRef.current.contains(event.target)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }
  }, [isOpen]);

  return (
    <div ref={containerRef} className="relative inline-block">
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { isOpen, setIsOpen })
      )}
    </div>
  );
};

const DropdownMenuTrigger = React.forwardRef(({ children, isOpen, setIsOpen, asChild, ...props }, ref) => {
  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children, {
      onClick: () => setIsOpen(!isOpen),
      ref,
      ...props,
    });
  }

  return (
    <button
      ref={ref}
      onClick={() => setIsOpen(!isOpen)}
      {...props}
    >
      {children}
    </button>
  );
});

DropdownMenuTrigger.displayName = "DropdownMenuTrigger";

const DropdownMenuContent = ({ children, isOpen, setIsOpen, align = "start", ...props }) => {
  if (!isOpen) return null;

  const alignClass =
    align === "end" ? "right-0" : align === "center" ? "left-1/2 -translate-x-1/2" : "left-0";

  return (
    <div
      className={`absolute top-full mt-1 ${alignClass} z-50 min-w-[160px] rounded-md border border-slate-200 bg-white p-1 shadow-md dark:border-slate-800 dark:bg-slate-900`}
      {...props}
    >
      {React.Children.map(children, (child) =>
        React.cloneElement(child, { setIsOpen })
      )}
    </div>
  );
};

const DropdownMenuItem = ({ children, onClick, className = "", setIsOpen, ...props }) => {
  const handleClick = (e) => {
    onClick?.(e);
    setIsOpen?.(false);
  };

  return (
    <button
      className={`relative flex cursor-pointer select-none items-center rounded-sm px-2 py-1.5 text-sm outline-none transition-colors hover:bg-slate-100 focus:bg-slate-100 data-[disabled]:pointer-events-none data-[disabled]:opacity-50 dark:hover:bg-slate-800 dark:focus:bg-slate-800 ${className}`}
      onClick={handleClick}
      {...props}
    >
      {children}
    </button>
  );
};

export {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
};
