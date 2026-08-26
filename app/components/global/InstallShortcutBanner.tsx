'use client';

import React, { useState, useEffect } from 'react';
import { Button, Box, IconButton, Paper, Typography, Fade, Dialog, DialogTitle, DialogContent, DialogActions } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddToHomeScreenIcon from '@mui/icons-material/AddToHomeScreen';
import IosShareIcon from '@mui/icons-material/IosShare';
import { useCustomTheme } from '@/app/lib/context/themeContext';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export default function InstallShortcutBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installable, setInstallable] = useState(false);
  const [isApple, setIsApple] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [showIosDialog, setShowIosDialog] = useState(false);
  const { theme } = useCustomTheme();
  const isDark = theme?.mode === 'dark';

  useEffect(() => {
    // Check if dismissed previously in this session
    const isDismissed = sessionStorage.getItem('myorbit_install_banner_dismissed') === 'true';
    if (isDismissed) return;

    // Check if already launched from Home Screen (standalone mode)
    if (typeof window !== 'undefined') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
      if (isStandalone) return;

      const userAgent = window.navigator.userAgent;
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const isIOS = /iPad|iPhone|iPod/.test(userAgent) && !(window as any).MSStream;

      const handler = (e: Event) => {
        e.preventDefault();
        setDeferredPrompt(e as BeforeInstallPromptEvent);
        setInstallable(true);
        setIsApple(false);
      };

      window.addEventListener('beforeinstallprompt', handler);

      if (isIOS) {
        setInstallable(true);
        setIsApple(true);
      }

      return () => {
        window.removeEventListener('beforeinstallprompt', handler);
      };
    }
  }, []);

  const handleInstallClick = async () => {
    if (isApple) {
      setShowIosDialog(true);
      return;
    }

    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choiceResult = await deferredPrompt.userChoice;
    console.log('Install outcome:', choiceResult.outcome);
    setDeferredPrompt(null);
    setInstallable(false);
  };

  const handleDismiss = () => {
    setDismissed(true);
    sessionStorage.setItem('myorbit_install_banner_dismissed', 'true');
  };

  if (dismissed || !installable) {
    return null;
  }

  return (
    <>
      <Fade in timeout={500}>
        <Box sx={{ mb: { xs: 2, sm: 3 } }}>
          <Paper
            elevation={0}
            sx={{
              p: 2,
              borderRadius: 3,
              display: 'flex',
              flexDirection: { xs: 'column', sm: 'row' },
              alignItems: 'center',
              justifyContent: 'space-between',
              gap: 2,
              background: isDark 
                ? 'linear-gradient(135deg, rgba(30, 41, 59, 0.95) 0%, rgba(15, 23, 42, 0.95) 100%)'
                : 'linear-gradient(135deg, rgba(255, 255, 255, 0.95) 0%, rgba(248, 250, 252, 0.95) 100%)',
              border: `1px solid ${isDark ? 'rgba(16, 185, 129, 0.3)' : 'rgba(16, 185, 129, 0.2)'}`,
              backdropFilter: 'blur(12px)',
              boxShadow: isDark 
                ? '0 10px 30px -10px rgba(0,0,0,0.5)'
                : '0 10px 30px -10px rgba(16,185,129,0.15)',
              position: 'relative',
              width: '100%',
            }}
          >
            {/* Absolute close button for mobile layout */}
            <IconButton
              size="small"
              onClick={handleDismiss}
              sx={{ 
                position: 'absolute', 
                top: 8, 
                right: 8,
                color: 'text.secondary',
                display: { xs: 'flex', sm: 'none' } 
              }}
            >
              <CloseIcon fontSize="small" />
            </IconButton>

            <Box sx={{ display: 'flex', alignItems: 'center', gap: 2 }}>
              <Box 
                sx={{ 
                  width: 38, 
                  height: 38, 
                  borderRadius: '12px', 
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: 'white',
                  flexShrink: 0,
                  boxShadow: '0 4px 10px rgba(16, 185, 129, 0.3)'
                }}
              >
                <AddToHomeScreenIcon sx={{ fontSize: 20 }} />
              </Box>
              <Box pr={{ xs: 3, sm: 0 }}>
                <Typography variant="body2" fontWeight="800" sx={{ color: isDark ? '#f8fafc' : '#0f172a' }}>
                  Create Screen Shortcut
                </Typography>
                <Typography variant="caption" sx={{ display: 'block', color: 'text.secondary', fontWeight: 500 }}>
                  Add MyOrbit to your home screen for quick, app-like access.
                </Typography>
              </Box>
            </Box>

            <Box sx={{ display: 'flex', gap: 1.5, width: { xs: '100%', sm: 'auto' }, alignItems: 'center' }}>
              <Button
                onClick={handleInstallClick}
                variant="contained"
                size="small"
                fullWidth
                sx={{
                  borderRadius: 2.5,
                  textTransform: 'none',
                  fontWeight: 700,
                  boxShadow: 'none',
                  px: 3,
                  py: 0.75,
                  background: 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
                  '&:hover': {
                    background: 'linear-gradient(135deg, #059669 0%, #047857 100%)',
                    boxShadow: '0 4px 12px rgba(16, 185, 129, 0.3)',
                  }
                }}
              >
                Add Shortcut
              </Button>
              <IconButton
                size="small"
                onClick={handleDismiss}
                sx={{ 
                  color: 'text.secondary',
                  display: { xs: 'none', sm: 'flex' }
                }}
              >
                <CloseIcon fontSize="small" />
              </IconButton>
            </Box>
          </Paper>
        </Box>
      </Fade>

      {/* iOS Manual Installation Guide Dialog */}
      <Dialog 
        open={showIosDialog} 
        onClose={() => setShowIosDialog(false)}
        PaperProps={{
          sx: {
            borderRadius: 4,
            p: 1.5,
            bgcolor: isDark ? '#1e293b' : '#ffffff',
            color: isDark ? '#f1f5f9' : '#0f172a',
          }
        }}
      >
        <DialogTitle sx={{ fontWeight: 800, display: 'flex', alignItems: 'center', gap: 1 }}>
          <IosShareIcon color="primary" /> Add to Home Screen
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" paragraph sx={{ lineHeight: 1.6 }}>
            iOS Safari doesn&apos;t support automatic installation. You can install it manually by following these simple steps:
          </Typography>
          <Box sx={{ pl: 2, display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              1. Tap the <strong>Share</strong> button <IosShareIcon fontSize="small" sx={{ mx: 0.5 }} /> in Safari&apos;s navigation bar.
            </Typography>
            <Typography variant="body2">
              2. Scroll down the sharing menu and select <strong>Add to Home Screen</strong>.
            </Typography>
            <Typography variant="body2">
              3. Tap <strong>Add</strong> in the top-right corner to confirm.
            </Typography>
          </Box>
        </DialogContent>
        <DialogActions>
          <Button 
            onClick={() => setShowIosDialog(false)}
            variant="contained"
            sx={{ borderRadius: 2.5, textTransform: 'none', px: 3, fontWeight: 700 }}
          >
            Got it
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
