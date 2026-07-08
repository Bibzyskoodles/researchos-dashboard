import React from 'react';
import { NavLink } from 'react-router-dom';
import { useAuth } from '../../store/AuthContext';
import { useAda } from '../../ada/AdaContext';
import { usePlatform } from '../../platform/PlatformProvider';
import { LogOut } from 'lucide-react';
import { colors, spacing, transitions, radius } from '../../designTokens';

export default function Sidebar() {
  const { user, org, logout } = useAuth();
  const { navigatePage } = useAda();
  const { navigation } = usePlatform();

  return (
    <aside style={{
      width: 240,
      background: colors.surface,
      borderRight: `1px solid ${colors.border}`,
      display: 'flex',
      flexDirection: 'column',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {/* Logo */}
      <div style={{
        padding: `${spacing.lg}px ${spacing.lg}px`,
        borderBottom: `1px solid ${colors.border}`,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: spacing.xs,
      }}>
        <img
          src="/researchos-logo.png"
          alt="ResearchOS"
          style={{
            width: '100%',
            maxWidth: 150,
            height: 'auto',
            objectFit: 'contain',
            display: 'block',
          }}
        />
        <div style={{
          fontSize: 10,
          color: colors.textQuaternary,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          paddingLeft: spacing.xs,
          fontWeight: 600,
        }}>
          by Intelligency AI
        </div>
      </div>

      {/* Nav */}
      <div style={{
        flex: 1,
        overflowY: 'auto',
        padding: `${spacing.md}px ${spacing.sm}px`,
      }}>
        {navigation.map(section => (
          <div key={section.id} style={{ marginBottom: spacing.lg }}>
            <div style={{
              fontSize: 11,
              fontWeight: 700,
              color: colors.textQuaternary,
              letterSpacing: 0.5,
              textTransform: 'uppercase',
              padding: `${spacing.sm}px ${spacing.sm}px`,
              marginBottom: spacing.sm,
            }}>
              {section.label}
            </div>
            {section.items.map(item => (
              <NavLink
                key={item.to}
                to={item.to}
                onClick={() => navigatePage(item.to.replace('/', ''))}
                style={({ isActive }) => ({
                  display: 'flex',
                  alignItems: 'center',
                  gap: spacing.md,
                  padding: `${spacing.md}px ${spacing.sm}px`,
                  borderRadius: radius.md,
                  marginBottom: spacing.xs,
                  color: isActive ? colors.primary : colors.textTertiary,
                  background: isActive ? colors.primaryLighter : 'transparent',
                  textDecoration: 'none',
                  fontSize: 14,
                  fontWeight: 500,
                  transition: transitions.normal,
                  cursor: 'pointer',
                  borderLeft: isActive ? `3px solid ${colors.primary}` : `3px solid transparent`,
                  paddingLeft: `calc(${spacing.sm}px - 3px)`,
                })}
              >
                <item.icon size={18} style={{ flexShrink: 0 }} />
                {item.label}
              </NavLink>
            ))}
          </div>
        ))}
      </div>

      {/* User */}
      <div style={{
        padding: `${spacing.md}px ${spacing.sm}px`,
        borderTop: `1px solid ${colors.border}`,
        background: colors.surfaceLow,
      }}>
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: spacing.md,
          padding: spacing.md,
          borderRadius: radius.lg,
        }}>
          <div style={{
            width: 36,
            height: 36,
            borderRadius: '50%',
            background: `linear-gradient(135deg, ${colors.primary}, ${colors.primaryLight})`,
            display: 'grid',
            placeItems: 'center',
            fontSize: 14,
            fontWeight: 700,
            color: colors.white,
            flexShrink: 0,
          }}>
            {user?.name?.charAt(0) || 'U'}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{
              fontSize: 13,
              fontWeight: 600,
              color: colors.textPrimary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {user?.name || 'User'}
            </div>
            <div style={{
              fontSize: 12,
              color: colors.textQuaternary,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}>
              {org?.name || 'Organisation'}
            </div>
          </div>
          <button
            onClick={logout}
            style={{
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              color: colors.textTertiary,
              padding: spacing.sm,
              borderRadius: radius.md,
              display: 'grid',
              placeItems: 'center',
              transition: transitions.fast,
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = colors.border;
              (e.currentTarget as HTMLButtonElement).style.color = colors.primary;
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'none';
              (e.currentTarget as HTMLButtonElement).style.color = colors.textTertiary;
            }}
            title="Logout"
          >
            <LogOut size={18} />
          </button>
        </div>
      </div>
    </aside>
  );
}
