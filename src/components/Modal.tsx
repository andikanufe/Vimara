'use client';

import React from 'react';

interface ModalProps {
    isOpen: boolean;
    title: string;
    message: string;
    confirmLabel?: string;
    cancelLabel?: string;
    variant?: 'danger' | 'primary' | 'success';
    onConfirm: () => void;
    onCancel: () => void;
}

export default function Modal({
    isOpen,
    title,
    message,
    confirmLabel = 'OK',
    cancelLabel,
    variant = 'primary',
    onConfirm,
    onCancel,
}: ModalProps) {
    if (!isOpen) return null;

    return (
        <div className="modal-overlay">
            <div className="modal-content">
                <h3 className="modal-title">{title}</h3>
                <p className="modal-body">{message}</p>
                <div className="modal-actions">
                    {cancelLabel && (
                        <button className="btn btn-outline" onClick={onCancel}>
                            {cancelLabel}
                        </button>
                    )}
                    <button
                        className={`btn ${variant === 'danger' ? 'btn-danger' : 'btn-primary'}`}
                        onClick={onConfirm}
                    >
                        {confirmLabel}
                    </button>
                </div>
            </div>
        </div>
    );
}
