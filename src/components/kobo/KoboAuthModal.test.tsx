import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import KoboAuthModal from './KoboAuthModal';
import { ConnectionStatus } from './KoboAuthModal';

/**
 * Test suite for KoboAuthModal component
 * Uses React Testing Library for comprehensive testing
 */

const mockOnConnect = jest.fn();
const mockOnDisconnect = jest.fn();
const mockOnClose = jest.fn();

const defaultProps = {
  isOpen: true,
  onClose: mockOnClose,
  onConnect: mockOnConnect,
  onDisconnect: mockOnDisconnect,
};

describe('KoboAuthModal', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('Rendering', () => {
    test('renders modal when open', () => {
      render(<KoboAuthModal {...defaultProps} />);

      expect(screen.getByText('KoboToolbox Connection')).toBeInTheDocument();
      expect(
        screen.getByText(
          /Connect your KoboToolbox account to enable data synchronization/
        )
      ).toBeInTheDocument();
    });

    test('does not render modal when closed', () => {
      const { container } = render(
        <KoboAuthModal {...defaultProps} isOpen={false} />
      );

      expect(container.firstChild).toBeNull();
    });

    test('renders server dropdown', () => {
      render(<KoboAuthModal {...defaultProps} />);

      const serverSelect = screen.getByDisplayValue('Humanitarian Response');
      expect(serverSelect).toBeInTheDocument();
    });

    test('renders API token input', () => {
      render(<KoboAuthModal {...defaultProps} />);

      expect(
        screen.getByPlaceholderText('Paste your API token here')
      ).toBeInTheDocument();
    });

    test('renders Test Connection button', () => {
      render(<KoboAuthModal {...defaultProps} />);

      expect(screen.getByText('Test Connection')).toBeInTheDocument();
    });

    test('renders Connect button', () => {
      render(<KoboAuthModal {...defaultProps} />);

      expect(screen.getByRole('button', { name: /Connect/ })).toBeInTheDocument();
    });

    test('renders Cancel button', () => {
      render(<KoboAuthModal {...defaultProps} />);

      expect(screen.getByText('Cancel')).toBeInTheDocument();
    });
  });

  describe('Form Validation', () => {
    test('shows validation error for empty token', async () => {
      render(<KoboAuthModal {...defaultProps} />);

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/API token is required/)).toBeInTheDocument();
      });
    });

    test('shows validation error for short token', async () => {
      render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      await userEvent.type(tokenInput, 'short');

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(
          screen.getByText(/API token appears invalid/)
        ).toBeInTheDocument();
      });
    });

    test('clears validation error on token input change', async () => {
      render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      await userEvent.type(tokenInput, 'short');

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText(/API token appears invalid/)).toBeInTheDocument();
      });

      // Type more characters
      await userEvent.type(tokenInput, 'token_that_is_much_longer');

      // Error should be cleared
      expect(screen.queryByText(/API token appears invalid/)).not.toBeInTheDocument();
    });

    test('disables Test Connection button when token is empty', () => {
      render(<KoboAuthModal {...defaultProps} />);

      const testButton = screen.getByText('Test Connection');
      expect(testButton).toBeDisabled();
    });

    test('enables Test Connection button when token is provided', async () => {
      render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      await userEvent.type(tokenInput, 'a'.repeat(30));

      const testButton = screen.getByText('Test Connection');
      expect(testButton).not.toBeDisabled();
    });
  });

  describe('Connection Testing', () => {
    test('calls onConnect when Test Connection is clicked', async () => {
      mockOnConnect.mockResolvedValueOnce({ username: 'testuser' });

      render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      await userEvent.type(tokenInput, 'a'.repeat(30));

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(mockOnConnect).toHaveBeenCalledWith(
          'https://api.kobo.humanitarianresponse.info',
          'a'.repeat(30)
        );
      });
    });

    test('shows loading state during connection test', async () => {
      mockOnConnect.mockImplementationOnce(
        () =>
          new Promise((resolve) =>
            setTimeout(
              () => resolve({ username: 'testuser' }),
              100
            )
          )
      );

      render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      await userEvent.type(tokenInput, 'a'.repeat(30));

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Testing')).toBeInTheDocument();
      });
    });

    test('shows success message on successful connection', async () => {
      mockOnConnect.mockResolvedValueOnce({ username: 'testuser' });

      render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      await userEvent.type(tokenInput, 'a'.repeat(30));

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Connected as: testuser')).toBeInTheDocument();
      });
    });

    test('shows error message on failed connection', async () => {
      mockOnConnect.mockRejectedValueOnce(new Error('Invalid token'));

      render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      await userEvent.type(tokenInput, 'a'.repeat(30));

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(screen.getByText('Connection Failed')).toBeInTheDocument();
        expect(screen.getByText('Invalid token')).toBeInTheDocument();
      });
    });
  });

  describe('Token Visibility Toggle', () => {
    test('toggles token visibility', async () => {
      render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText(
        'Paste your API token here'
      ) as HTMLInputElement;
      const toggleButton = screen.getByLabelText('Show token');

      // Initially hidden
      expect(tokenInput.type).toBe('password');

      // Toggle to show
      fireEvent.click(toggleButton);
      expect(tokenInput.type).toBe('text');

      // Toggle to hide
      fireEvent.click(toggleButton);
      expect(tokenInput.type).toBe('password');
    });
  });

  describe('Server Selection', () => {
    test('shows custom server URL input when custom server selected', async () => {
      render(<KoboAuthModal {...defaultProps} />);

      const serverSelect = screen.getByDisplayValue('Humanitarian Response');
      await userEvent.selectOptions(serverSelect, 'custom');

      await waitFor(() => {
        expect(
          screen.getByPlaceholderText('https://kobo.example.com')
        ).toBeInTheDocument();
      });
    });

    test('uses custom server URL in onConnect call', async () => {
      mockOnConnect.mockResolvedValueOnce({ username: 'testuser' });

      render(<KoboAuthModal {...defaultProps} />);

      const serverSelect = screen.getByDisplayValue('Humanitarian Response');
      await userEvent.selectOptions(serverSelect, 'custom');

      const customInput = screen.getByPlaceholderText(
        'https://kobo.example.com'
      );
      await userEvent.type(customInput, 'https://my-kobo.org');

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      await userEvent.type(tokenInput, 'a'.repeat(30));

      const testButton = screen.getByText('Test Connection');
      fireEvent.click(testButton);

      await waitFor(() => {
        expect(mockOnConnect).toHaveBeenCalledWith(
          'https://my-kobo.org',
          expect.anything()
        );
      });
    });
  });

  describe('Connected State', () => {
    test('shows connection status when already connected', () => {
      const connectedStatus: ConnectionStatus = {
        state: 'connected',
        username: 'existinguser',
      };

      render(
        <KoboAuthModal
          {...defaultProps}
          currentStatus={connectedStatus}
        />
      );

      expect(
        screen.getByText('Connected as: existinguser')
      ).toBeInTheDocument();
    });

    test('shows Done and Disconnect buttons when connected', () => {
      const connectedStatus: ConnectionStatus = {
        state: 'connected',
        username: 'existinguser',
      };

      render(
        <KoboAuthModal
          {...defaultProps}
          currentStatus={connectedStatus}
        />
      );

      expect(screen.getByText('Done')).toBeInTheDocument();
      expect(screen.getByText('Disconnect')).toBeInTheDocument();
    });

    test('hides server and token inputs when connected', () => {
      const connectedStatus: ConnectionStatus = {
        state: 'connected',
        username: 'existinguser',
      };

      render(
        <KoboAuthModal
          {...defaultProps}
          currentStatus={connectedStatus}
        />
      );

      expect(
        screen.queryByPlaceholderText('Paste your API token here')
      ).not.toBeInTheDocument();
    });

    test('shows auto-sync option when connected', () => {
      const connectedStatus: ConnectionStatus = {
        state: 'connected',
        username: 'existinguser',
      };

      render(
        <KoboAuthModal
          {...defaultProps}
          currentStatus={connectedStatus}
        />
      );

      expect(screen.getByText('Enable Auto-Sync')).toBeInTheDocument();
    });
  });

  describe('Disconnection', () => {
    test('shows disconnect confirmation on disconnect click', () => {
      const connectedStatus: ConnectionStatus = {
        state: 'connected',
        username: 'testuser',
      };

      render(
        <KoboAuthModal
          {...defaultProps}
          currentStatus={connectedStatus}
        />
      );

      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      expect(screen.getByText('Keep Connected')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Disconnect/ })).toBeInTheDocument();
    });

    test('calls onDisconnect when confirmed', async () => {
      mockOnDisconnect.mockResolvedValueOnce(undefined);

      const connectedStatus: ConnectionStatus = {
        state: 'connected',
        username: 'testuser',
      };

      render(
        <KoboAuthModal
          {...defaultProps}
          currentStatus={connectedStatus}
        />
      );

      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      const confirmButton = screen.getByRole('button', { name: /Disconnect/ });
      fireEvent.click(confirmButton);

      await waitFor(() => {
        expect(mockOnDisconnect).toHaveBeenCalled();
      });
    });

    test('cancels disconnection when Keep Connected clicked', async () => {
      const connectedStatus: ConnectionStatus = {
        state: 'connected',
        username: 'testuser',
      };

      render(
        <KoboAuthModal
          {...defaultProps}
          currentStatus={connectedStatus}
        />
      );

      const disconnectButton = screen.getByText('Disconnect');
      fireEvent.click(disconnectButton);

      const keepButton = screen.getByText('Keep Connected');
      fireEvent.click(keepButton);

      expect(mockOnDisconnect).not.toHaveBeenCalled();
    });
  });

  describe('Modal Close', () => {
    test('calls onClose when Cancel is clicked', () => {
      render(<KoboAuthModal {...defaultProps} />);

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      expect(mockOnClose).toHaveBeenCalled();
    });

    test('clears form on close', async () => {
      const { rerender } = render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      await userEvent.type(tokenInput, 'sometoken');

      const cancelButton = screen.getByText('Cancel');
      fireEvent.click(cancelButton);

      // Reopen modal
      rerender(<KoboAuthModal {...defaultProps} />);

      const newTokenInput = screen.getByPlaceholderText(
        'Paste your API token here'
      ) as HTMLInputElement;
      expect(newTokenInput.value).toBe('');
    });
  });

  describe('Accessibility', () => {
    test('has proper ARIA labels', () => {
      render(<KoboAuthModal {...defaultProps} />);

      expect(screen.getByLabelText('Show token')).toBeInTheDocument();
    });

    test('focuses form elements correctly', async () => {
      render(<KoboAuthModal {...defaultProps} />);

      const tokenInput = screen.getByPlaceholderText('Paste your API token here');
      tokenInput.focus();

      expect(document.activeElement).toBe(tokenInput);
    });
  });

  describe('Dark Mode', () => {
    test('applies dark mode classes when in dark theme', () => {
      const { container } = render(<KoboAuthModal {...defaultProps} />);

      const modalContent = container.querySelector('.dark\\:bg-slate-900');
      expect(modalContent).toBeInTheDocument();
    });
  });
});
