import React, { useState, useRef, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { colors, spacing, radius, shadows, transitions } from '../../designTokens';

interface DropdownItem {
  label: string;
  value: string;
  icon?: React.ReactNode;
  divider?: boolean;
}

interface DropdownProps {
  items: DropdownItem[];
  onSelect: (value: string) => void;
  trigger?: React.ReactNode;
  placeholder?: string;
  value?: string;
}

export function Dropdown({
  items,
  onSelect,
  trigger,
  placeholder = 'Select...',
  value,
}: DropdownProps) {
  const [isOpen, setIsOpen] = useState(false);
  const triggerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        triggerRef.current &&
        !triggerRef.current.contains(event.target as Node) &&
        menuRef.current &&
        !menuRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const selectedItem = items.find((item) => item.value === value);

  return (
    <div style={{ position: 'relative', display: 'inline-block', width: '100%' }}>
      <div
        ref={triggerRef}
        onClick={() => setIsOpen(!isOpen)}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: `${spacing.md}px ${spacing.md}px`,
          border: `1px solid ${colors.border}`,
          borderRadius: radius.md,
          background: colors.surface,
          cursor: 'pointer',
          transition: transitions.normal,
        }}
        onMouseEnter={(e) => {
          (e.currentTarget as HTMLDivElement).style.borderColor = colors.primary;
        }}
        onMouseLeave={(e) => {
          if (!isOpen) {
            (e.currentTarget as HTMLDivElement).style.borderColor = colors.border;
          }
        }}
      >
        <span style={{
          color: selectedItem ? colors.textPrimary : colors.textQuaternary,
          fontSize: 14,
          fontWeight: 500,
        }}>
          {trigger ? trigger : (selectedItem?.label || placeholder)}
        </span>
        <ChevronDown
          size={18}
          color={colors.textTertiary}
          style={{
            transition: transitions.fast,
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
          }}
        />
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            ref={menuRef}
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.15 }}
            style={{
              position: 'absolute',
              top: 'calc(100% + 8px)',
              left: 0,
              right: 0,
              background: colors.surface,
              border: `1px solid ${colors.border}`,
              borderRadius: radius.lg,
              boxShadow: shadows.lg,
              zIndex: 999,
              overflow: 'hidden',
            }}
          >
            {items.map((item, index) => (
              <div key={item.value}>
                {item.divider && (
                  <div
                    style={{
                      height: 1,
                      background: colors.border,
                      margin: `${spacing.xs}px 0`,
                    }}
                  />
                )}
                <div
                  onClick={() => {
                    onSelect(item.value);
                    setIsOpen(false);
                  }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: spacing.md,
                    padding: `${spacing.md}px ${spacing.lg}px`,
                    cursor: 'pointer',
                    transition: transitions.fast,
                    background:
                      item.value === value ? colors.primaryLighter : 'transparent',
                    color: item.value === value ? colors.primary : colors.textSecondary,
                    fontSize: 14,
                    fontWeight: 500,
                  }}
                  onMouseEnter={(e) => {
                    if (item.value !== value) {
                      (e.currentTarget as HTMLDivElement).style.background = colors.surfaceHover;
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (item.value !== value) {
                      (e.currentTarget as HTMLDivElement).style.background = 'transparent';
                    }
                  }}
                >
                  {item.icon && <span style={{ display: 'flex' }}>{item.icon}</span>}
                  {item.label}
                </div>
              </div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
