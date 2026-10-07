import { redirect } from 'next/navigation';

export default function AdminRoot() {
  // Instantly redirects anyone who visits /admin to the dashboard
  redirect('/admin/dashboard'); 
}