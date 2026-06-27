import React, { useState } from 'react';
import { api, Employee } from '../../services/api';
import { Button } from '../atoms/Button';
import { Input } from '../atoms/Input';
import { FormField } from '../molecules/FormField';

interface UserFormProps {
  onSuccess: (newUser: Employee) => void;
  onErrorToast: (message: string) => void;
  businessId: string;
}

export const UserForm: React.FC<UserFormProps> = ({ onSuccess, onErrorToast, businessId }) => {
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'waiter' | 'cashier' | 'kitchen'>('waiter');
  
  const [nameError, setNameError] = useState<string | null>(null);
  const [pinError, setPinError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  const validate = (): boolean => {
    let isValid = true;

    // Validate Name
    if (!name.trim()) {
      setNameError('El nombre es obligatorio.');
      isValid = false;
    } else if (name.length > 50) {
      setNameError('El nombre no debe exceder los 50 caracteres.');
      isValid = false;
    } else {
      setNameError(null);
    }

    // Validate PIN (exactly 4 digits, numeric)
    const pinRegex = /^[0-9]{4}$/;
    if (!pin) {
      setPinError('El PIN es obligatorio.');
      isValid = false;
    } else if (!pinRegex.test(pin)) {
      setPinError('El PIN debe ser un número de exactamente 4 dígitos.');
      isValid = false;
    } else {
      setPinError(null);
    }

    return isValid;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setIsLoading(true);
    try {
      const response = await api.addUser({
        name: name.trim(),
        pin,
        role,
      }, businessId);

      if (response.success && response.user) {
        onSuccess(response.user);
        // Clear fields
        setName('');
        setPin('');
        setRole('waiter');
      } else {
        onErrorToast('No se pudo registrar el usuario.');
      }
    } catch (err: any) {
      onErrorToast(err.message || 'Error al conectar con el servidor.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="p-6 bg-onyx-surface border border-aged-bronze/40 rounded-lg flex flex-col gap-5 w-full shadow-lg shadow-obsidian/40"
    >
      <div className="border-b border-aged-bronze/20 pb-3">
        <h3 className="font-display text-lg text-champagne-gold tracking-wide uppercase">
          Registrar Personal
        </h3>
        <p className="text-xs text-text-secondary mt-0.5 font-sans">
          Crea credenciales PIN de acceso para terminales POS.
        </p>
      </div>

      {/* Name Input */}
      <FormField label="Nombre Completo" error={nameError || undefined} required>
        <Input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
            if (nameError) setNameError(null);
          }}
          placeholder="Ej. Sofía Castro"
          disabled={isLoading}
        />
      </FormField>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* PIN Input */}
        <FormField label="PIN de Acceso (4 dígitos)" error={pinError || undefined} required>
          <Input
            type="text"
            maxLength={4}
            value={pin}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, ''); // Numeric only
              setPin(val);
              if (pinError) setPinError(null);
            }}
            placeholder="Ej. 4321"
            disabled={isLoading}
          />
        </FormField>

        {/* Role Selection */}
        <div className="flex flex-col gap-1.5 w-full">
          <label className="text-sm font-semibold tracking-wide text-text-secondary">
            Rol del Empleado <span className="text-champagne-gold">*</span>
          </label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as any)}
            disabled={isLoading}
            className="w-full px-4 py-2 bg-onyx-surface text-text-primary border border-aged-bronze focus:border-champagne-gold focus:ring-champagne-gold/50 rounded font-sans focus:outline-none focus:ring-2 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <option value="waiter">Mesero (Waiter)</option>
            <option value="cashier">Cajero (Cashier)</option>
            <option value="kitchen">Pantalla Cocina (Kitchen)</option>
          </select>
        </div>
      </div>

      <Button type="submit" disabled={isLoading} className="mt-2 flex items-center justify-center gap-2">
        {isLoading ? (
          <>
            <svg className="animate-spin h-5 w-5 text-obsidian" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Guardando...</span>
          </>
        ) : (
          <>
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
            </svg>
            <span>Crear Empleado</span>
          </>
        )}
      </Button>
    </form>
  );
};
