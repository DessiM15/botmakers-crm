import { Client, Environment } from 'square';

let squareClient = null;

function getSquareClient() {
  if (!process.env.SQUARE_ACCESS_TOKEN) return null;
  if (!squareClient) {
    squareClient = new Client({
      accessToken: process.env.SQUARE_ACCESS_TOKEN,
      environment:
        process.env.SQUARE_ENVIRONMENT === 'sandbox'
          ? Environment.Sandbox
          : Environment.Production,
    });
  }
  return squareClient;
}

/**
 * Check if Square is configured.
 */
export function isSquareConfigured() {
  return !!process.env.SQUARE_ACCESS_TOKEN;
}

/**
 * Get the Square environment string.
 */
export function getSquareEnvironment() {
  return process.env.SQUARE_ENVIRONMENT || 'production';
}

/**
 * Create and send a Square invoice.
 * Returns { squareInvoiceId, squarePaymentUrl } or null on failure.
 */
export async function createSquareInvoice(clientEmail, title, lineItems, dueDate) {
  const client = getSquareClient();
  if (!client) return null;

  try {
    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) {
      // CB-INT-003: SQUARE_LOCATION_ID not set
      return null;
    }

    // Search for or create customer
    let customerId;
    const { result: searchResult } = await client.customersApi.searchCustomers({
      query: {
        filter: {
          emailAddress: { exact: clientEmail },
        },
      },
    });

    if (searchResult.customers && searchResult.customers.length > 0) {
      customerId = searchResult.customers[0].id;
    } else {
      const { result: createResult } = await client.customersApi.createCustomer({
        emailAddress: clientEmail,
      });
      customerId = createResult.customer.id;
    }

    // Build order line items
    const orderLineItems = lineItems.map((item) => ({
      name: item.description,
      quantity: String(item.quantity || 1),
      basePriceMoney: {
        amount: BigInt(Math.round(Number(item.unitPrice) * 100)),
        currency: 'USD',
      },
    }));

    // Create order
    const { result: orderResult } = await client.ordersApi.createOrder({
      order: {
        locationId,
        customerId,
        lineItems: orderLineItems,
      },
      idempotencyKey: crypto.randomUUID(),
    });

    const orderId = orderResult.order.id;

    // Build invoice
    const invoiceData = {
      invoice: {
        locationId,
        orderId,
        primaryRecipient: { customerId },
        paymentRequests: [
          {
            requestType: 'BALANCE',
            dueDate: dueDate
              ? new Date(dueDate).toISOString().split('T')[0]
              : new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)
                  .toISOString()
                  .split('T')[0],
            automaticPaymentSource: 'NONE',
          },
        ],
        deliveryMethod: 'EMAIL',
        title,
        acceptedPaymentMethods: {
          card: true,
          squareGiftCard: false,
          bankAccount: true,
          buyNowPayLater: false,
          cashAppPay: false,
        },
      },
      idempotencyKey: crypto.randomUUID(),
    };

    const { result: invoiceResult } = await client.invoicesApi.createInvoice(invoiceData);
    const squareInvoice = invoiceResult.invoice;

    // Publish (send) the invoice
    const { result: publishResult } = await client.invoicesApi.publishInvoice(
      squareInvoice.id,
      {
        version: squareInvoice.version,
        idempotencyKey: crypto.randomUUID(),
      }
    );

    const publishedInvoice = publishResult.invoice;
    const paymentUrl = publishedInvoice.publicUrl || null;

    return {
      squareInvoiceId: publishedInvoice.id,
      squarePaymentUrl: paymentUrl,
    };
  } catch (error) {
    return null;
  }
}

/**
 * Create a Square checkout payment link.
 * Returns { paymentUrl } or null on failure.
 */
export async function createSquareCheckoutLink(title, amount) {
  const client = getSquareClient();
  if (!client) return null;

  try {
    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) {
      // CB-INT-003: SQUARE_LOCATION_ID not set
      return null;
    }

    const { result } = await client.checkoutApi.createPaymentLink({
      idempotencyKey: crypto.randomUUID(),
      order: {
        locationId,
        lineItems: [
          {
            name: title,
            quantity: '1',
            basePriceMoney: {
              amount: BigInt(Math.round(Number(amount) * 100)),
              currency: 'USD',
            },
          },
        ],
      },
    });

    return {
      paymentUrl: result.paymentLink.url,
      paymentLinkId: result.paymentLink.id,
    };
  } catch (error) {
    return null;
  }
}

/**
 * List recent invoices from Square.
 */
export async function getSquareInvoices(limit = 100) {
  const client = getSquareClient();
  if (!client) return [];

  try {
    const locationId = process.env.SQUARE_LOCATION_ID;
    if (!locationId) return [];

    const { result } = await client.invoicesApi.listInvoices({
      locationId,
      limit,
    });

    return result.invoices || [];
  } catch (error) {
    return [];
  }
}

/**
 * List recent payments from Square.
 */
export async function getSquarePayments(limit = 100) {
  const client = getSquareClient();
  if (!client) return [];

  try {
    const { result } = await client.paymentsApi.listPayments({
      limit,
      sortOrder: 'DESC',
    });

    return result.payments || [];
  } catch (error) {
    return [];
  }
}
