/**
 * Automated Security Verification Script
 * Run this to verify Priority 0 security fixes
 *
 * Usage:
 *   npx ts-node scripts/verify-security-fixes.ts
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!
const SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
})

interface TestResult {
  test: string
  passed: boolean
  message: string
}

const results: TestResult[] = []

function log(message: string, type: 'info' | 'success' | 'error' | 'warn' = 'info') {
  const icons = {
    info: '📋',
    success: '✅',
    error: '❌',
    warn: '⚠️'
  }
  console.log(`${icons[type]} ${message}`)
}

async function testRLSPolicies() {
  log('Testing RLS Policies...', 'info')

  try {
    // Check if RLS is enabled on orders table
    const { data, error } = await supabase.rpc('check_rls_enabled', {
      table_name: 'orders'
    }).single()

    // Alternative: Query pg_policies
    const { data: policies } = await supabase
      .from('pg_policies')
      .select('*')
      .eq('tablename', 'orders')

    if (policies && policies.length >= 6) {
      results.push({
        test: 'RLS Policies Exist',
        passed: true,
        message: `Found ${policies.length} policies on orders table`
      })
      log(`RLS Policies: ${policies.length} policies found`, 'success')
    } else {
      results.push({
        test: 'RLS Policies Exist',
        passed: false,
        message: 'RLS policies not found or incomplete'
      })
      log('RLS Policies: Missing or incomplete', 'error')
    }
  } catch (error: any) {
    results.push({
      test: 'RLS Policies Check',
      passed: false,
      message: error.message
    })
    log(`RLS Check Failed: ${error.message}`, 'error')
  }
}

async function testOrdersTableColumns() {
  log('Testing Orders Table Structure...', 'info')

  try {
    // Check if required security columns exist
    const { data: columns, error } = await supabase
      .from('information_schema.columns')
      .select('column_name')
      .eq('table_name', 'orders')
      .in('column_name', ['buyer_id', 'seller_id', 'stripe_payment_intent_id', 'escrow_status', 'is_guest_order'])

    if (columns && columns.length >= 5) {
      results.push({
        test: 'Orders Table Columns',
        passed: true,
        message: 'All required security columns exist'
      })
      log('Orders table columns: All present', 'success')
    } else {
      results.push({
        test: 'Orders Table Columns',
        passed: false,
        message: 'Missing required columns'
      })
      log('Orders table: Missing columns', 'warn')
    }
  } catch (error: any) {
    results.push({
      test: 'Orders Table Structure',
      passed: false,
      message: error.message
    })
    log(`Table check failed: ${error.message}`, 'error')
  }
}

async function testServiceRoleAccess() {
  log('Testing Service Role Access...', 'info')

  try {
    // Service role should be able to query orders without RLS restrictions
    const { data, error } = await supabase
      .from('orders')
      .select('id')
      .limit(1)

    if (!error) {
      results.push({
        test: 'Service Role Access',
        passed: true,
        message: 'Service role can bypass RLS'
      })
      log('Service role: Working correctly', 'success')
    } else {
      results.push({
        test: 'Service Role Access',
        passed: false,
        message: error.message
      })
      log(`Service role error: ${error.message}`, 'error')
    }
  } catch (error: any) {
    results.push({
      test: 'Service Role Access',
      passed: false,
      message: error.message
    })
    log(`Service role test failed: ${error.message}`, 'error')
  }
}

async function testRateLimitUtility() {
  log('Testing Rate Limit Utility...', 'info')

  try {
    // Import the rate limit functions
    const { rateLimit, getRateLimitStatus, resetRateLimit } = await import('../src/lib/utils/rate-limit')

    // Test basic rate limiting
    resetRateLimit('test-key')

    let successCount = 0
    for (let i = 0; i < 12; i++) {
      if (rateLimit('test-key', 10, 60000)) {
        successCount++
      }
    }

    if (successCount === 10) {
      results.push({
        test: 'Rate Limit Logic',
        passed: true,
        message: 'Rate limiting works correctly (10/10 allowed, 2 blocked)'
      })
      log('Rate limiting: Working correctly', 'success')
    } else {
      results.push({
        test: 'Rate Limit Logic',
        passed: false,
        message: `Expected 10 successes, got ${successCount}`
      })
      log(`Rate limiting: Unexpected behavior (${successCount}/10)`, 'error')
    }

    // Test status check
    const status = getRateLimitStatus('test-key', 10)
    if (status.remaining === 0 && status.isLimited) {
      log('Rate limit status check: Working', 'success')
    }

  } catch (error: any) {
    results.push({
      test: 'Rate Limit Utility',
      passed: false,
      message: error.message
    })
    log(`Rate limit test failed: ${error.message}`, 'error')
  }
}

async function testWebhookRoute() {
  log('Testing Webhook Route Exists...', 'info')

  try {
    const fs = await import('fs')
    const path = await import('path')

    const webhookPath = path.join(process.cwd(), 'src/app/api/stripe/webhook/route.ts')

    if (fs.existsSync(webhookPath)) {
      const content = fs.readFileSync(webhookPath, 'utf-8')

      // Check for critical security features
      const hasSignatureVerification = content.includes('stripe.webhooks.constructEvent')
      const hasDuplicateCheck = content.includes('existingOrder')
      const hasServiceRole = content.includes('SUPABASE_SERVICE_ROLE_KEY')

      if (hasSignatureVerification && hasDuplicateCheck && hasServiceRole) {
        results.push({
          test: 'Webhook Security Features',
          passed: true,
          message: 'Signature verification, duplicate check, and service role present'
        })
        log('Webhook handler: All security features present', 'success')
      } else {
        results.push({
          test: 'Webhook Security Features',
          passed: false,
          message: 'Missing security features'
        })
        log('Webhook handler: Missing security features', 'warn')
      }
    } else {
      results.push({
        test: 'Webhook Route Exists',
        passed: false,
        message: 'Webhook route file not found'
      })
      log('Webhook route: File not found', 'error')
    }
  } catch (error: any) {
    results.push({
      test: 'Webhook Route Check',
      passed: false,
      message: error.message
    })
    log(`Webhook check failed: ${error.message}`, 'error')
  }
}

async function testOrderActionsSecurity() {
  log('Testing Order Actions Security...', 'info')

  try {
    const fs = await import('fs')
    const path = await import('path')

    const ordersPath = path.join(process.cwd(), 'src/lib/actions/orders.ts')
    const content = fs.readFileSync(ordersPath, 'utf-8')

    // Check critical security fixes
    const hasBuyerIdRemoval = !content.includes('data.buyerId !== user.id') // Old vulnerable code
    const hasAuthDerivedBuyerId = content.includes('buyerId = user.id') || content.includes('const buyerId')
    const hasRateLimitImport = content.includes('rateLimitCreateOrder')
    const hasEmailStripping = content.includes('delete order.seller.email') || content.includes('delete order.buyer.email')
    const hasSelfPurchaseCheck = content.includes('Cannot purchase your own listing')

    const securityFeatures = {
      'BuyerId derived from auth': hasAuthDerivedBuyerId,
      'Rate limiting applied': hasRateLimitImport,
      'Email privacy (strip emails)': hasEmailStripping,
      'Self-purchase prevention': hasSelfPurchaseCheck
    }

    const allPassed = Object.values(securityFeatures).every(v => v)

    if (allPassed) {
      results.push({
        test: 'Order Actions Security',
        passed: true,
        message: 'All security features implemented'
      })
      log('Order actions: All security features present', 'success')
    } else {
      results.push({
        test: 'Order Actions Security',
        passed: false,
        message: `Missing features: ${Object.entries(securityFeatures).filter(([, v]) => !v).map(([k]) => k).join(', ')}`
      })
      log('Order actions: Some security features missing', 'warn')
    }
  } catch (error: any) {
    results.push({
      test: 'Order Actions Security',
      passed: false,
      message: error.message
    })
    log(`Order actions check failed: ${error.message}`, 'error')
  }
}

async function printSummary() {
  console.log('\n' + '='.repeat(60))
  log('SECURITY VERIFICATION SUMMARY', 'info')
  console.log('='.repeat(60) + '\n')

  const passed = results.filter(r => r.passed).length
  const failed = results.filter(r => !r.passed).length
  const total = results.length

  results.forEach(result => {
    const icon = result.passed ? '✅' : '❌'
    console.log(`${icon} ${result.test}`)
    console.log(`   ${result.message}\n`)
  })

  console.log('='.repeat(60))
  log(`Tests Passed: ${passed}/${total}`, passed === total ? 'success' : 'warn')
  log(`Tests Failed: ${failed}/${total}`, failed > 0 ? 'error' : 'success')
  console.log('='.repeat(60) + '\n')

  if (passed === total) {
    log('🎉 All security checks passed! Priority 0 is complete.', 'success')
    log('📝 Next: Run manual tests from test-priority-0-security.md', 'info')
    log('🚀 Then proceed to Priority 1 (Marketplace Features)', 'info')
  } else {
    log('⚠️  Some checks failed. Review the issues above.', 'warn')
    log('📖 See test-priority-0-security.md for detailed testing', 'info')
  }
}

async function main() {
  console.log('\n' + '='.repeat(60))
  log('PRIORITY 0 SECURITY VERIFICATION', 'info')
  log('Automated checks for security fixes', 'info')
  console.log('='.repeat(60) + '\n')

  await testRLSPolicies()
  await testOrdersTableColumns()
  await testServiceRoleAccess()
  await testRateLimitUtility()
  await testWebhookRoute()
  await testOrderActionsSecurity()

  await printSummary()
}

main().catch(console.error)
