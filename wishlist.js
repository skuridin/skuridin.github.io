const { createApp, ref, onMounted } = Vue;

createApp({
  setup() {
    const items = ref([]);
    const loading = ref(true);
    const error = ref(false);

    const loadWishlist = async () => {
      try {
        const response = await fetch('wishlist.json');
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const data = await response.json();
        items.value = data.items;
        loading.value = false;
        
      } catch (err) {
        console.error('Error loading wishlist:', err);
        error.value = true;
        loading.value = false;
      }
    };

    onMounted(() => {
      loadWishlist();
    });

    return {
      items,
      loading,
      error
    };
  }
}).mount('#app');