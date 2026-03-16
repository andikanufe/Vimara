'use client';

import React, { createContext, useContext, useState, ReactNode, useCallback } from 'react';
import Modal from '@/components/Modal';
import { ToastContainer, ToastType } from '@/components/Toast';

interface ModalState {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary';
    onConfirm?: () => void;
    onCancel?: () => void;
}

interface UIContextType {
    alert: (title: string, message: string) => Promise<void>;
    confirm: (title: string, message: string, variant?: 'danger' | 'primary') => Promise<boolean>;
    toast: (message: string, type?: ToastType) => void;
}

const UIContext = createContext<UIContextType | undefined>(undefined);

export function UIProvider({ children }: { children: ReactNode }) {
    const [modal, setModal] = useState<ModalState>({ isOpen: false, title: '', message: '' });
    const [toasts, setToasts] = useState<{ id: string; message: string; type: ToastType }[]>([]);

    const showAlert = useCallback((title: string, message: string) => {
        return new Promise<void>((resolve) => {
            setModal({
                isOpen: true,
                title,
                message,
                confirmLabel: 'OK',
                onConfirm: () => {
                    setModal((prev) => ({ ...prev, isOpen: false }));
                    resolve();
                },
            });
        });
    }, []);

    const showConfirm = useCallback((title: string, message: string, variant: 'danger' | 'primary' = 'primary') => {
        return new Promise<boolean>((resolve) => {
            setModal({
                isOpen: true,
                title,
                message,
                confirmLabel: 'Ya, Lanjutkan',
                cancelLabel: 'Batal',
                variant,
                onConfirm: () => {
                    setModal((prev) => ({ ...prev, isOpen: false }));
                    resolve(true);
                },
                onCancel: () => {
                    setModal((prev) => ({ ...prev, isOpen: false }));
                    resolve(false);
                },
            });
        });
    }, []);

    const toast = useCallback((message: string, type: ToastType = 'info') => {
        const id = Math.random().toString(36).substring(2, 9);
        setToasts((prev) => [...prev, { id, message, type }]);
    }, []);

    const removeToast = useCallback((id: string) => {
        setToasts((prev) => prev.filter((t) => t.id !== id));
    }, []);

    return (
        <UIContext.Provider value={{ alert: showAlert, confirm: showConfirm, toast }}>
            {children}
            <Modal
                isOpen={modal.isOpen}
                title={modal.title}
                message={modal.message}
                confirmLabel={modal.confirmLabel}
                cancelLabel={modal.cancelLabel}
                variant={modal.variant}
                onConfirm={modal.onConfirm || (() => { })}
                onCancel={modal.onCancel || (() => { })}
            />
            <ToastContainer toasts={toasts} removeToast={removeToast} />
        </UIContext.Provider>
    );
}

export function useUI() {
    const context = useContext(UIContext);
    if (!context) throw new Error('useUI must be used within UIProvider');
    return context;
}
