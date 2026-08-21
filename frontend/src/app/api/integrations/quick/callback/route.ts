import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
    const searchParams = request.nextUrl.searchParams
    const companyId = searchParams.get('company_id') || ''
    const orgId = searchParams.get('org_id') || ''
    const secret = searchParams.get('secret') || ''
    const status = searchParams.get('status') || ''

    const backendUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000'

    // Forward handshake to FastAPI backend if parameters are present
    if (status === 'success' && orgId && companyId && secret) {
        try {
            await fetch(`${backendUrl}/api/integrations/quick/callback?org_id=${encodeURIComponent(orgId)}&company_id=${encodeURIComponent(companyId)}&secret=${encodeURIComponent(secret)}&status=${encodeURIComponent(status)}`)
        } catch (e) {
            console.error('Error forwarding callback to backend:', e)
        }
    }

    const html = `<!DOCTYPE html>
<html>
<head>
    <meta charset="utf-8">
    <title>Vinculación Exitosa</title>
    <script src="https://cdn.tailwindcss.com"></script>
</head>
<body class="bg-slate-50 min-h-screen flex items-center justify-center p-4 text-center font-sans">
    <div class="max-w-sm w-full bg-white rounded-3xl p-6 shadow-xl border border-slate-100">
        <div class="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-2xl flex items-center justify-center text-2xl mx-auto mb-4">
            ✓
        </div>
        <h2 class="text-xl font-bold text-slate-800">¡Vinculación Exitosa!</h2>
        <p class="text-xs text-slate-500 mt-1">Se ha conectado con VerumQuick correctamente.</p>
        <p class="text-[11px] text-slate-400 mt-4">Cerrando ventana automáticamente...</p>
    </div>
    <script>
        if (window.opener) {
            window.opener.postMessage({ type: 'VERUM_QUICK_LINKED', company_id: '${companyId}' }, '*');
        }
        setTimeout(() => {
            window.close();
        }, 1200);
    </script>
</body>
</html>`

    return new NextResponse(html, {
        headers: { 'Content-Type': 'text/html; charset=utf-8' },
    })
}
