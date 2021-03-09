export const theme = {
  // Pagination
  pagination: {
    base:
      'flex flex-col justify-between text-xs sm:flex-row text-neutral-600 dark:text-neutral-400',
  },
  // TableFooter
  tableFooter: {
    base:
      'px-4 py-3 border-t dark:border-neutral-700 bg-neutral-50 text-neutral-500 dark:text-neutral-400 dark:bg-neutral-800',
  },
  // TableRow
  tableRow: {
    base: '',
  },
  // TableHeader
  tableHeader: {
    base:
      'text-xs font-semibold tracking-wide text-left text-neutral-500 uppercase border-b dark:border-neutral-700 bg-neutral-50 dark:text-neutral-400 dark:bg-neutral-800',
  },
  // TableContainer
  tableContainer: {
    base: 'w-full overflow-hidden rounded-lg shadow-xs',
  },
  // TableCell
  tableCell: {
    base: 'px-4 py-3',
  },
  // TableBody
  tableBody: {
    base:
      'bg-white divide-y dark:divide-neutral-700 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-400',
  },
  // Dropdown
  dropdown: {
    base: `absolute w-56 mt-2 text-neutral-600 bg-white border border-neutral-100 rounded-lg shadow-md min-w-max-content dark:text-neutral-300 dark:border-neutral-700 dark:bg-neutral-700`,
    align: {
      left: 'left-0',
      right: 'right-0',
    },
  },
  // Avatar
  avatar: {
    base: 'relative rounded-full inline-block',
    size: {
      large: 'w-10 h-10',
      regular: 'w-8 h-8',
      small: 'w-6 h-6',
    },
  },
  // Modal
  modal: {
    base:
      ' px-6 py-4 overflow-hidden bg-white rounded-t-lg dark:bg-neutral-800 sm:rounded-lg sm:m-4 sm:max-w-xl',
  },
  // ModalBody
  modalBody: {
    base: 'mb-6 text-sm text-neutral-700 dark:text-neutral-400',
  },
  // ModalFooter
  modalFooter: {
    base:
      'flex flex-col items-center justify-end px-6 py-3 -mx-6 -mb-4 space-y-4 sm:space-y-0 sm:space-x-6 sm:flex-row bg-neutral-50 dark:bg-neutral-800',
  },
  // ModalHeader
  modalHeader: {
    base: 'mt-4 mb-2 text-lg font-semibold text-neutral-700 dark:text-neutral-300',
  },
  // Badge
  badge: {
    base: 'inline-flex px-2 text-xs font-medium leading-5 rounded-full',
    success: 'text-success-700 bg-success-100 dark:bg-success-700 dark:text-success-100',
    danger: 'text-danger-700 bg-danger-100 dark:text-danger-100 dark:bg-danger-700',
    warning: 'text-warning-700 bg-warning-100 dark:text-white dark:bg-warning-600',
    neutral: 'text-neutral-700 bg-neutral-100 dark:text-neutral-100 dark:bg-neutral-700',
    primary: 'text-primary-700 bg-primary-100 dark:text-white dark:bg-primary-600',
  },
  // Backdrop
  backdrop: {
    base:
      'fixed inset-0 z-40 flex items-end bg-black bg-opacity-50 sm:items-center sm:justify-center',
  },
  // Textarea
  textarea: {
    base: 'block  text-sm dark:text-neutral-300 form-textarea focus:outline-none',
    active:
      'focus:border-primary-400 dark:border-neutral-600 dark:focus:border-neutral-600 dark:bg-neutral-700 dark:focus:shadow-outline-neutral focus:shadow-outline-primary',
    disabled: 'cursor-not-allowed opacity-50 bg-neutral-300 dark:bg-neutral-800',
    valid:
      'border-success-600 dark:bg-neutral-700 focus:border-success-400 dark:focus:border-success-400 focus:shadow-outline-success dark:focus:shadow-outline-success',
    invalid:
      'border-danger-600 dark:bg-neutral-700 focus:border-danger-400 dark:focus:border-danger-400 focus:shadow-outline-danger dark:focus:shadow-outline-danger',
  },
  // Select
  select: {
    base: 'block  text-sm dark:text-neutral-300 focus:outline-none',
    active:
      'focus:border-primary-400 dark:border-neutral-600 dark:bg-neutral-700 focus:shadow-outline-primary dark:focus:shadow-outline-neutral dark:focus:border-neutral-600',
    select: 'form-select leading-5',
    multiple: 'form-multiselect',
    disabled: 'cursor-not-allowed opacity-50 bg-neutral-300 dark:bg-neutral-800',
    valid:
      'border-success-600 dark:bg-neutral-700 focus:border-success-400 dark:focus:border-success-400 focus:shadow-outline-success dark:focus:shadow-outline-success',
    invalid:
      'border-danger-600 dark:bg-neutral-700 focus:border-danger-400 dark:focus:border-danger-400 focus:shadow-outline-danger dark:focus:shadow-outline-danger',
  },
  // Label
  label: {
    base: 'block text-sm text-neutral-700 dark:text-neutral-400',
    // check and radio get this same style
    check: 'inline-flex items-center',
    disabled: 'opacity-50 cursor-not-allowed',
  },
  // Input
  input: {
    base: 'block text-sm font-mono focus:outline-none dark:text-neutral-300 form-input leading-5',
    active:
      'focus:border-primary-400 dark:border-neutral-600 focus:shadow-outline-primary dark:focus:border-neutral-600 dark:focus:shadow-outline-neutral dark:bg-neutral-700',
    disabled: 'cursor-not-allowed opacity-50 bg-neutral-300 dark:bg-neutral-800',
    valid:
      'border-success-600 dark:bg-neutral-700 focus:border-success-400 dark:focus:border-success-400 focus:shadow-outline-success dark:focus:shadow-outline-success',
    invalid:
      'border-danger-600 dark:bg-neutral-700 focus:border-danger-400 dark:focus:border-danger-400 focus:shadow-outline-danger dark:focus:shadow-outline-danger',
    radio:
      'text-primary-600 form-radio focus:border-primary-400 focus:outline-none focus:shadow-outline-primary dark:focus:shadow-outline-neutral',
    checkbox:
      'text-primary-600 form-checkbox focus:border-primary-400 focus:outline-none focus:shadow-outline-primary dark:focus:shadow-outline-neutral',
  },
  // HelperText
  helperText: {
    base: 'text-xs',
    valid: 'text-success-600 dark:text-success-400',
    invalid: 'text-danger-600 dark:text-danger-400',
  },
  // Card
  card: {
    base: 'min-w-0 rounded-lg shadow-xs overflow-hidden',
    default: 'bg-white dark:bg-neutral-800',
  },
  cardBody: {
    base: 'p-4',
  },
  // Button
  button: {
    base:
      'align-bottom inline-flex items-center justify-center cursor-pointer leading-5 transition-colors duration-150 font-medium focus:outline-none',
    block: 'w-full',
    size: {
      larger: 'px-10 py-4 rounded-lg',
      large: 'px-5 py-3 rounded-lg',
      regular: 'px-3 py-1 rounded-md text-sm',
      small: 'px-2 py-1 rounded-md text-xs',
      icon: {
        larger: 'p-4 rounded-lg',
        large: 'p-3 rounded-lg',
        regular: 'p-2 rounded-lg',
        small: 'p-2 rounded-md',
      },
      pagination: 'px-3 py-1 rounded-md text-xs',
    },
    // styles applied to the SVG icon
    icon: {
      larger: 'h-5 w-5',
      large: 'h-5 w-5',
      regular: 'h-5 w-5',
      small: 'h-3 w-3',
      left: 'mr-2 -ml-1',
      right: 'ml-2 -mr-1',
    },
    primary: {
      base: 'text-white bg-primary-600 border border-transparent',
      active: 'active:bg-primary-600 hover:bg-primary-700 focus:shadow-outline-primary',
      disabled: 'opacity-50 cursor-not-allowed',
    },
    outline: {
      base: 'text-neutral-600 border-neutral-300 border dark:text-neutral-400 focus:outline-none',
      active:
        'active:bg-transparent hover:border-neutral-500 focus:border-neutral-500 active:text-neutral-500 focus:shadow-outline-neutral',
      disabled: 'opacity-50 cursor-not-allowed bg-neutral-300',
    },
    link: {
      base: 'text-neutral-600 dark:text-neutral-400 focus:outline-none border border-transparent',
      active:
        'active:bg-transparent hover:bg-neutral-100 focus:shadow-outline-neutral dark:hover:bg-neutral-500 dark:hover:text-neutral-300 dark:hover:bg-opacity-10',
      disabled: 'opacity-50 cursor-not-allowed',
    },
    // this is the button that lives inside the DropdownItem
    dropdownItem: {
      base:
        'inline-flex items-center cursor-pointer w-full px-2 py-1 text-sm font-medium transition-colors duration-150 rounded-md hover:bg-neutral-100 hover:text-neutral-800 dark:hover:bg-neutral-800 dark:hover:text-neutral-200',
    },
  },
}
