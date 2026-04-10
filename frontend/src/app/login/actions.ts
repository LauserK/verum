'use server'

import { revalidatePath } from 'next/cache'
import { redirect } from 'next/navigation'
import { createClient } from '@/utils/supabase/server'

export async function login(formData: FormData) {
    const email = formData.get('email') as string
    const password = formData.get('password') as string

    if (!email || !password) {
        return { error: 'Email and password are required' }
    }

    const supabase = await createClient()

    const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
    })

    if (error) {
        return { error: error.message }
    }

    // Try to sync with backend after successful login
    try {
        const res = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/sync`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${data.session.access_token}`
            }
        });

        if (res.ok) {
            const syncData = await res.json();
            if (syncData.organization_is_active === false) {
                // Sign out immediately if org is inactive
                await supabase.auth.signOut();
                return { error: 'Su organización está inactiva. Contacte a soporte.' };
            }
        } else {
            console.warn('Failed to sync user with backend:', await res.text());
        }
    } catch (err) {
        console.warn('Could not reach backend for sync:', err);
    }

    revalidatePath('/', 'layout')
    redirect('/venue-selection')
}

export async function logout() {
    const supabase = await createClient()

    await supabase.auth.signOut()

    revalidatePath('/', 'layout')
    redirect('/login')
}
