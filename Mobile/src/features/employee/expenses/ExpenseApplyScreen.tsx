import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, StyleSheet, View } from 'react-native';

import {
  AppText,
  Button,
  Card,
  DateField,
  FormSection,
  Icon,
  Screen,
  SelectField,
  TextField,
  toast,
} from '@/components';
import { captureCameraImage, pickImage, pickPdf, type PickedFile } from '@/features/shared/media/pickers';
import { api, getErrorMessage, toFormData } from '@/services/api';
import { useQueryKeys } from '@/services/queryKeys';
import { useSession } from '@/services/session';
import { useTheme } from '@/theme';

const CATEGORIES = [
  { label: 'Travel & Commute', value: 'Travel' },
  { label: 'Food & Meals', value: 'Food & Meals' },
  { label: 'Equipment & Hardware', value: 'Equipment & Hardware' },
  { label: 'Internet & Mobile', value: 'Internet & Mobile' },
  { label: 'Office Supplies', value: 'Office Supplies' },
  { label: 'Training & Certifications', value: 'Training & Certifications' },
  { label: 'Client Entertainment', value: 'Client Entertainment' },
  { label: 'Other', value: 'Other' },
];

export function ExpenseApplyScreen() {
  const theme = useTheme();
  const router = useRouter();
  const keys = useQueryKeys();
  const queryClient = useQueryClient();
  const { canWrite } = useSession();

  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Travel');
  const [amount, setAmount] = useState('');
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [description, setDescription] = useState('');
  const [receipt, setReceipt] = useState<PickedFile | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const handleCamera = async () => {
    const res = await captureCameraImage({ allowsEditing: true });
    if (res.status === 'picked') {
      setReceipt(res.file);
      toast.success('Receipt photo captured.');
    } else if (res.status === 'denied') {
      Alert.alert('Camera Permission Required', res.message);
    } else if (res.status === 'error') {
      toast.error(res.message);
    }
  };

  const handleLibrary = async () => {
    const res = await pickImage();
    if (res.status === 'picked') {
      setReceipt(res.file);
      toast.success('Receipt photo selected.');
    } else if (res.status === 'denied') {
      Alert.alert('Photo Permission Required', res.message);
    } else if (res.status === 'error') {
      toast.error(res.message);
    }
  };

  const handlePdf = async () => {
    const res = await pickPdf();
    if (res.status === 'picked') {
      setReceipt(res.file);
      toast.success('PDF bill selected.');
    } else if (res.status === 'error') {
      toast.error(res.message);
    }
  };

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Please enter an expense title.');
      return;
    }
    const numAmount = parseFloat(amount);
    if (!numAmount || numAmount <= 0) {
      toast.error('Please enter a valid amount greater than ₹0.');
      return;
    }
    if (!receipt) {
      toast.error('Please attach a bill or receipt photo.');
      return;
    }

    setSubmitting(true);
    try {
      const filePart = { uri: receipt.uri, name: receipt.name, type: receipt.type };
      const form = toFormData(
        {
          title: title.trim(),
          category,
          amount: String(numAmount),
          date,
          description: description.trim(),
        },
        { receipt: filePart }
      );

      await api.post('/api/expenses', form);
      await queryClient.invalidateQueries({ queryKey: keys.expenses() });
      toast.success('Expense claim submitted successfully.');
      router.back();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Failed to submit expense claim.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Screen keyboardAvoiding padded>
      <FormSection title="Claim details" description="Enter the details of your business expense.">
        <TextField
          label="Title / Purpose *"
          placeholder="e.g. Client dinner, Taxi to airport, Monitor stand"
          value={title}
          onChangeText={setTitle}
        />

        <SelectField
          label="Category *"
          value={category}
          options={CATEGORIES}
          onChange={(val) => setCategory(val)}
        />

        <TextField
          label="Amount (₹) *"
          placeholder="e.g. 1500"
          value={amount}
          onChangeText={setAmount}
          keyboardType="numeric"
        />

        <DateField
          label="Date of Expense *"
          value={date}
          onChange={(d) => setDate(d ?? '')}
        />

        <TextField
          label="Description / Remarks"
          placeholder="Additional notes for your manager or admin"
          value={description}
          onChangeText={setDescription}
          multiline
          numberOfLines={3}
        />
      </FormSection>

      <FormSection title="Receipt or Bill *" description="Capture with camera or attach image / PDF.">
        {receipt ? (
          <Card style={styles.attachedCard}>
            <View style={styles.attachedRow}>
              <Icon name="document-attach" size={24} color={theme.colors.primary} />
              <View style={styles.attachedInfo}>
                <AppText variant="bodyStrong" numberOfLines={1}>{receipt.name}</AppText>
                <AppText variant="caption" color="textSecondary">
                  {receipt.size ? `${(receipt.size / 1024).toFixed(1)} KB` : 'Attached'}
                </AppText>
              </View>
              <Pressable onPress={() => setReceipt(null)} style={styles.removeBtn}>
                <Icon name="close-circle" size={20} color={theme.colors.danger} />
              </Pressable>
            </View>
          </Card>
        ) : (
          <View style={styles.attachButtonsRow}>
            <Button
              label="Camera"
              icon="camera-outline"
              variant="secondary"
              onPress={handleCamera}
              style={{ flex: 1 }}
            />
            <Button
              label="Photos"
              icon="images-outline"
              variant="secondary"
              onPress={handleLibrary}
              style={{ flex: 1 }}
            />
            <Button
              label="PDF"
              icon="document-outline"
              variant="secondary"
              onPress={handlePdf}
              style={{ flex: 1 }}
            />
          </View>
        )}
      </FormSection>

      <View style={{ marginTop: 24 }}>
        <Button
          label={submitting ? 'Submitting claim…' : 'Submit Expense Claim'}
          disabled={submitting || !canWrite}
          onPress={handleSubmit}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  attachButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  attachedCard: {
    padding: 12,
  },
  attachedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  attachedInfo: {
    flex: 1,
  },
  removeBtn: {
    padding: 4,
  },
});
