import { usePaystackPayment } from 'react-paystack';
import { useToast } from './use-toast';
import { supabase } from '@/integrations/supabase/client';
import { GenericChildStackGroup, GenericChildStackGroup } from 'recharts/types/util/ChartUtils';

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';

interface PaystackConfig {
    email: string;
    amount: number; // in kobo (multiply by 100)
    reference: string;
    currency: "GHS";
    metadata?: Record<string, any>;
}

export const usePaystack = () => {
    const { toast } = useToast();

    const initializePayment = (
        config: PaystackConfig,
        onSuccess: (reference: string) => void,
        onClose: () => void
    ) => {
        const paystackConfig = {
            ...config,
            publicKey: PAYSTACK_PUBLIC_KEY,
        };

        const initializePaystackPayment = usePaystackPayment(paystackConfig);

        const handleSuccess = (reference: any) => {
            console.log('Payment successful:', reference);
            onSuccess(reference.reference || reference.trans || reference);
        };

        const handleClose = () => {
            console.log('Payment popup closed');
            toast({
                title: 'Payment Cancelled',
                description: 'You closed the payment window',
            });
            onClose();
        };

        return {
            initializePayment: () => initializePaystackPayment(handleSuccess, handleClose),
        };
    };

    const verifyPayment = async (reference: string) => {
        try {
            const { data, error } = await supabase.functions.invoke('verify-payment', {
                body: { reference },
            });

            if (error) throw error;
            return data;
        } catch (error: any) {
            console.error('Payment verification error:', error);
            throw error;
        }
    };

    return {
        initializePayment,
        verifyPayment,
    };
};
