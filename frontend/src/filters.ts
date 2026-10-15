import { createSlice, PayloadAction } from '@reduxjs/toolkit';

export type FilterState = {
  search: string;
  category: string;
  paymentMethod: string;
  minDate: string;
  maxDate: string;
  minAmount: string;
  maxAmount: string;
  sortBy: 'date' | 'amount';
  sortOrder: 'asc' | 'desc';
  page: number;
};

const initialState: FilterState = {
  search: '',
  category: '',
  paymentMethod: '',
  minDate: '',
  maxDate: '',
  minAmount: '',
  maxAmount: '',
  sortBy: 'date',
  sortOrder: 'desc',
  page: 1,
};

const filterSlice = createSlice({
  name: 'filters',
  initialState,
  reducers: {
    setFilter: <K extends keyof FilterState>(
      state: FilterState,
      action: PayloadAction<{ key: K; value: FilterState[K] }>,
    ) => {
      state[action.payload.key] = action.payload.value;
      if (action.payload.key !== 'page') state.page = 1;
    },
    setPage: (state, action: PayloadAction<number>) => {
      state.page = action.payload;
    },
    clearFilters: () => initialState,
  },
});

export const { setFilter, setPage, clearFilters } = filterSlice.actions;
export default filterSlice.reducer;
