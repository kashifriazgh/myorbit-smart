import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Typography,
  FormControl,
  InputLabel,
  Select,
  MenuItem,
  TextField,
  Stack,
  CircularProgress,
} from '@mui/material';
import { Bank, Expenditure } from '@/app/lib/interface';

interface MarkAsPaidDialogProps {
  open: boolean;
  onClose: () => void;
  expenditure: Expenditure | null;
  deductionSource: string;
  setDeductionSource: (v: string) => void;
  banks: Bank[];
  selectedBank: string;
  setSelectedBank: (v: string) => void;
  newBankName: string;
  setNewBankName: (v: string) => void;
  insufficientFunds: boolean;
  availableFunds: number;
  actionLoading: boolean;
  onConfirm: (updateFunds: boolean) => void;
  onAddBank: () => void;
}

export default function MarkAsPaidDialog({
  open,
  onClose,
  expenditure,
  deductionSource,
  setDeductionSource,
  banks,
  selectedBank,
  setSelectedBank,
  newBankName,
  setNewBankName,
  insufficientFunds,
  availableFunds,
  actionLoading,
  onConfirm,
  onAddBank,
}: MarkAsPaidDialogProps) {
  return (
    <Dialog open={open} onClose={onClose}>
      <DialogTitle>Deduct from Fund</DialogTitle>
      <DialogContent>
        <Typography>
          Do you want to deduct Rs <strong>{expenditure?.amount}</strong> for{' '}
          <em>{expenditure?.title}</em>?
        </Typography>
        <FormControl fullWidth sx={{ mt: 2 }} size="small">
          <InputLabel>Deduct From</InputLabel>
          <Select
            value={deductionSource}
            onChange={(e) => setDeductionSource(e.target.value)}
          >
            {['in_hand', 'bank', 'easypaisa', 'jazzcash', 'other'].map(
              (mode) => (
                <MenuItem key={mode} value={mode}>
                  {mode}
                </MenuItem>
              )
            )}
          </Select>
        </FormControl>

        {deductionSource === 'bank' && (
          <Stack direction="row" spacing={1} sx={{ mt: 2 }}>
            <FormControl fullWidth size="small">
              <InputLabel>Bank</InputLabel>
              <Select
                value={selectedBank}
                onChange={(e) => setSelectedBank(e.target.value)}
              >
                {banks.map((bank) => (
                  <MenuItem key={bank.id} value={bank.id}>
                    {bank.name}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
            <TextField
              label="New Bank"
              size="small"
              value={newBankName}
              onChange={(e) => setNewBankName(e.target.value)}
            />
            <Button
              variant="outlined"
              size="small"
              onClick={onAddBank}
              disabled={!newBankName.trim() || actionLoading}
            >
              Add Bank
            </Button>
          </Stack>
        )}

        {insufficientFunds && (
          <Typography mt={2} color="error" fontWeight="bold" fontSize={14}>
            ⚠️ Insufficient funds — Available: Rs{' '}
            {availableFunds.toLocaleString()}
          </Typography>
        )}
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          onClick={() => onConfirm(false)}
          color="warning"
          disabled={actionLoading}
        >
          No
        </Button>
        <Button
          variant="contained"
          onClick={() => onConfirm(true)}
          disabled={
            actionLoading ||
            insufficientFunds ||
            (deductionSource === 'bank' && !selectedBank)
          }
        >
          {actionLoading ? <CircularProgress size={18} /> : 'Confirm'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}
