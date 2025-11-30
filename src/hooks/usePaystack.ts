import { usePaystackPayment } from 'react-paystack';
import { useToast } from './use-toast';

const PAYSTACK_PUBLIC_KEY = import.meta.env.VITE_PAYSTACK_PUBLIC_KEY || '';

interface PaystackConfig {
    email: string;
    amount: number; // in kobo (multiply by 100)
    reference: string;
    currency?: string;
    metadata?: {
        order_id?: string;
        user_id?: string;
        custom_fields?: Array<{
            display_name: string;
            variable_name: string;
            value: string;
        }>;
    };
}

export const usePaystack = () => {
    const { toast } = useToast();

    const initializePayment = (
        config: PaystackConfig,
        onSuccess: (reference: any) => void,
        onClose: () => void
    ) => {
        const paystackConfig = {
            email: config.email,
            amount: config.amount,
            reference: config.reference,
            currency: config.currency || 'GHS',
            metadata: config.metadata,
            publicKey: PAYSTACK_PUBLIC_KEY,
        };

        const initializePaystackPayment = usePaystackPayment(paystackConfig);

        const handleSuccess = (reference: any) => {
            console.log('Payment successful:', reference);
            onSuccess(reference);
        };

        const handleClose = () => {
            console.log('Payment popup closed');
            toast({
                title: 'Payment Cancelled',
                description: 'You closed the payment window',
            });
            onClose();
        };

        // Call the payment initialization
        initializePaystackPayment(handleSuccess, handleClose);
    };

    return {
        initializePayment,
    };
};
