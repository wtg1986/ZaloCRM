/**
 * use-list-sale-assignments.ts — State + actions for sale assignment pool per CustomerList.
 */
import { ref } from 'vue';
import {
  listSaleAssignments,
  upsertSaleAssignments,
  listOrgUsers,
  type SaleAssignmentDto,
  type OrgUserDto,
  type UpsertAssignmentInput,
} from '@/api/list-sale-assignment-api';

export function useListSaleAssignments() {
  const assignments = ref<SaleAssignmentDto[]>([]);
  const orgUsers = ref<OrgUserDto[]>([]);
  const loading = ref(false);
  const saving = ref(false);
  const error = ref('');

  async function load(listId: string): Promise<void> {
    loading.value = true;
    error.value = '';
    try {
      const [assignData, usersData] = await Promise.all([
        listSaleAssignments(listId),
        listOrgUsers(),
      ]);
      assignments.value = assignData;
      orgUsers.value = usersData;
    } catch (err) {
      error.value = (err as Error).message ?? 'Không thể tải danh sách phân sale';
    } finally {
      loading.value = false;
    }
  }

  async function save(
    listId: string,
    pool: UpsertAssignmentInput[],
  ): Promise<SaleAssignmentDto[]> {
    saving.value = true;
    error.value = '';
    try {
      const result = await upsertSaleAssignments(listId, pool);
      assignments.value = result;
      return result;
    } catch (err) {
      error.value = (err as Error).message ?? 'Không thể lưu phân sale';
      throw err;
    } finally {
      saving.value = false;
    }
  }

  function reset(): void {
    assignments.value = [];
    error.value = '';
  }

  return {
    assignments,
    orgUsers,
    loading,
    saving,
    error,
    load,
    save,
    reset,
  };
}
