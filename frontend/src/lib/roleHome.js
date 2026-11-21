// A role enters its own workspace; customers and guests enter the public menu.
export function getHomePath(role) {
  switch (role) {
    case 'staff':
    case 'cashier':
      return '/staff/tables';
    case 'kitchen':
      return '/kitchen';
    case 'admin':
      return '/operations';
    default:
      return '/';
  }
}

export function showPublicMenu(role) {
  return !role || role === 'customer' || role === 'admin';
}

export function showCustomerCart(role) {
  return !role || role === 'customer';
}
