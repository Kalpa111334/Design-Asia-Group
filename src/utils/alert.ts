import Swal, { SweetAlertIcon } from 'sweetalert2';
import 'sweetalert2/dist/sweetalert2.min.css';

export const alertSuccess = (title: string, text?: string) =>
  Swal.fire({ icon: 'success', title, text });

export const alertError = (title: string, text?: string) =>
  Swal.fire({ icon: 'error', title, text });

export const alertInfo = (title: string, text?: string) =>
  Swal.fire({ icon: 'info', title, text });

export const alertConfirm = async (title: string, text?: string, confirmButtonText = 'Yes', cancelButtonText = 'Cancel') => {
  const result = await Swal.fire({
    title,
    text,
    icon: 'question',
    showCancelButton: true,
    confirmButtonText,
    cancelButtonText,
    reverseButtons: true,
  });
  return result.isConfirmed;
};

export const toast = (title: string, icon: SweetAlertIcon = 'success') =>
  Swal.fire({
    toast: true,
    position: 'top-end',
    icon,
    title,
    showConfirmButton: false,
    timer: 3000,
    timerProgressBar: true,
  });

export default {
  success: alertSuccess,
  error: alertError,
  info: alertInfo,
  confirm: alertConfirm,
  toast,
};


