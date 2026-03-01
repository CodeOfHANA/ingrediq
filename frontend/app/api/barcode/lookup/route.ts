import { NextRequest, NextResponse } from 'next/server'

const OPEN_FOOD_FACTS_URL = 'https://world.openfoodfacts.org/api/v0/product'

export async function GET(req: NextRequest) {
    const code = req.nextUrl.searchParams.get('code')
    if (!code) {
        return NextResponse.json({ error: 'code parameter required' }, { status: 400 })
    }

    try {
        const res = await fetch(`${OPEN_FOOD_FACTS_URL}/${code}.json`, {
            headers: { 'User-Agent': 'IngredIQ/1.0 (contact@ingrediq.app)' },
            next: { revalidate: 3600 },
        })
        const data = await res.json()

        if (data.status !== 1 || !data.product) {
            return NextResponse.json({ error: 'Product not found in Open Food Facts database.' }, { status: 404 })
        }

        const product = data.product
        return NextResponse.json({
            productName: product.product_name || null,
            ingredientsText: product.ingredients_text || null,
            brand: product.brands || null,
        })
    } catch (error) {
        console.error('Barcode lookup error:', error)
        return NextResponse.json({ error: 'Barcode lookup failed' }, { status: 500 })
    }
}
