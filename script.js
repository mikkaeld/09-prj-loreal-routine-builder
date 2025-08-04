/* Import marked library for markdown parsing */
import { marked } from "https://cdn.jsdelivr.net/npm/marked/lib/marked.esm.js";

// Configure marked options for security and styling
marked.setOptions({
  breaks: true,  // Convert \n to <br>
  gfm: true,     // Enable GitHub Flavored Markdown
  headerIds: false, // Disable header IDs for security
  mangle: false,   // Disable mangling for security
  sanitize: true   // Enable sanitization for security
});

/* Language Support */
function setDirection(direction) {
  // Set direction on html element
  document.documentElement.dir = direction;
  
  // Update button states
  document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.dataset.active = (btn.dataset.dir === direction).toString();
  });
  
  // Save preference
  localStorage.setItem('direction', direction);
}

// Toggle language menu
const languageToggle = document.querySelector('.language-toggle');
const languageMenu = document.querySelector('.language-menu');

languageToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  languageMenu.classList.toggle('show');
});

// Close menu when clicking outside
document.addEventListener('click', (e) => {
  if (!e.target.closest('.language-support')) {
    languageMenu.classList.remove('show');
  }
});

// Handle direction changes
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    setDirection(btn.dataset.dir);
    languageMenu.classList.remove('show'); // Close menu after selection
  });
});

// Load saved direction preference
const savedDirection = localStorage.getItem('direction');
if (savedDirection) {
  setDirection(savedDirection);
} else {
  setDirection('ltr'); // Default to LTR
}

/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const generateRoutineBtn = document.getElementById("generateRoutine");
const selectedProductsList = document.getElementById("selectedProductsList");

// Create modal container
document.body.insertAdjacentHTML('beforeend', `
  <div id="productModal" class="modal">
    <div class="modal-content">
      <span class="close-modal">&times;</span>
      <div class="modal-body">
        <img id="modalImage" src="" alt="">
        <h2 id="modalTitle"></h2>
        <p id="modalBrand"></p>
        <p id="modalDescription"></p>
      </div>
    </div>
  </div>
`);

// Store conversation history (system prompt handled by Worker)
let conversationHistory = [];

// Store selected products
let selectedProducts = [];

// Load selected products from localStorage
function loadSelectedProducts() {
  const savedProducts = localStorage.getItem('selectedProducts');
  if (savedProducts) {
    try {
      selectedProducts = JSON.parse(savedProducts);
      updateSelectedProductsList();
    } catch (error) {
      console.error('Error loading saved products:', error);
      localStorage.removeItem('selectedProducts');
    }
  }
}

// Save selected products to localStorage
function saveSelectedProducts() {
  try {
    localStorage.setItem('selectedProducts', JSON.stringify(selectedProducts));
  } catch (error) {
    console.error('Error saving products:', error);
  }
}

// Load saved products when page loads
loadSelectedProducts();

// Modal functionality
const modal = document.getElementById('productModal');
const modalImage = document.getElementById('modalImage');
const modalTitle = document.getElementById('modalTitle');
const modalBrand = document.getElementById('modalBrand');
const modalDescription = document.getElementById('modalDescription');

// Close modal when clicking the X button
document.querySelector('.close-modal').addEventListener('click', () => {
  modal.style.display = 'none';
});

// Close modal when clicking outside
window.addEventListener('click', (e) => {
  if (e.target === modal) {
    modal.style.display = 'none';
  }
});

// Show modal when clicking "Click for more details"
productsContainer.addEventListener('click', (e) => {
  if (e.target.classList.contains('details-btn')) {
    const btn = e.target;
    modalImage.src = btn.dataset.image;
    modalImage.alt = btn.dataset.name;
    modalTitle.textContent = btn.dataset.name;
    modalBrand.textContent = btn.dataset.brand;
    modalDescription.textContent = btn.dataset.description;
    modal.style.display = 'block';
    e.stopPropagation(); // Prevent product selection when clicking the button
  }
});

/* Show initial placeholder until user selects a category */
productsContainer.innerHTML = `
  <div class="placeholder-message">
    Select a category to view products
  </div>
`;

/* Load product data from JSON file */
async function loadProducts() {
  const response = await fetch("products.json");
  const data = await response.json();
  return data.products;
}

/* Create HTML for displaying product cards */
function displayProducts(products) {
  productsContainer.innerHTML = products
    .map(
      (product) => {
        // Safely encode the product data to prevent JSON parsing errors
        const encodedProduct = encodeURIComponent(JSON.stringify(product));
        return `
    <div class="product-card ${selectedProducts.some(p => p.name === product.name) ? 'selected' : ''}" 
         data-product="${encodedProduct}">
      <div class="product-content">
        <img src="${product.image}" alt="${product.name}">
        <div class="product-info">
          <h3>${product.name}</h3>
          <p>${product.brand}</p>
          ${product.description ? `
            <div class="description-preview">
              <p class="preview-text">${product.description}</p>
              <button class="details-btn" 
                data-name="${product.name}"
                data-brand="${product.brand}"
                data-description="${product.description}"
                data-image="${product.image}">
                Click for more details
              </button>
            </div>
          ` : ''}
        </div>
      </div>
    </div>
  `;
      }
    )
    .join("");
}

/* Get reference to search input */
const productSearch = document.getElementById("productSearch");

/* Store all products globally for filtering */
let allProducts = [];

/* Load initial products */
(async () => {
  allProducts = await loadProducts();
})();

/* Function to filter products by category and search term */
async function filterProducts() {
  const selectedCategory = categoryFilter.value;
  const searchTerm = productSearch.value.toLowerCase().trim();

  // If no category selected and search is empty, show placeholder
  if (!selectedCategory && !searchTerm) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        Select a category to view products
      </div>
    `;
    return;
  }

  const filteredProducts = allProducts.filter(product => {
    const matchesCategory = selectedCategory && selectedCategory !== "all" ? 
      product.category === selectedCategory : true;
    const matchesSearch = searchTerm ? (
      product.name.toLowerCase().includes(searchTerm) ||
      product.brand.toLowerCase().includes(searchTerm) ||
      product.description.toLowerCase().includes(searchTerm)
    ) : true;

    return matchesCategory && matchesSearch;
  });

  // If no products match the search, show a message
  if (filteredProducts.length === 0) {
    productsContainer.innerHTML = `
      <div class="placeholder-message">
        ${searchTerm ? 
          `No products found matching "${productSearch.value}"` :
          'No products found in this category'}
        ${searchTerm && !selectedCategory ? 
          '<br><span class="search-tip">Try selecting a category first</span>' : ''}
      </div>
    `;
    return;
  }

  // Show products with saved selection states
  displayProducts(filteredProducts);
  
  // Highlight any selected products in this category
  selectedProducts.forEach(selectedProduct => {
    const productCard = document.querySelector(`[data-product*="\\"name\\":\\"\${selectedProduct.name}\\""]`);
    if (productCard) {
      productCard.classList.add("selected");
    }
  });
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", filterProducts);

/* Filter products when user types in search box */
let searchTimeout;
productSearch.addEventListener("input", () => {
  // Clear previous timeout
  if (searchTimeout) {
    clearTimeout(searchTimeout);
  }
  
  // Add debounce to prevent too many refreshes
  searchTimeout = setTimeout(filterProducts, 300);
});

/* Handle search field blur */
productSearch.addEventListener("blur", () => {
  if (!productSearch.value.trim()) {
    productSearch.value = ""; // Clear any whitespace
    filterProducts(); // This will show initial placeholder if no category selected
  }
});

/* Handle product selection */
productsContainer.addEventListener("click", (e) => {
  // Don't select product if clicking the details button
  if (e.target.classList.contains('details-btn')) return;
  
  const productCard = e.target.closest(".product-card");
  if (!productCard) return;

  try {
    // Decode the URI-encoded JSON string before parsing
    const encodedData = productCard.dataset.product;
    const decodedData = decodeURIComponent(encodedData);
    const productData = JSON.parse(decodedData);
    
    // Toggle selection
    const index = selectedProducts.findIndex(p => p.name === productData.name);
    if (index === -1) {
      selectedProducts.push(productData);
      productCard.classList.add("selected");
    } else {
      selectedProducts.splice(index, 1);
      productCard.classList.remove("selected");
    }

    // Update selected products list and save
    updateSelectedProductsList();
    saveSelectedProducts();
  } catch (error) {
    console.error('Error processing product data:', error);
    // Show an error message to the user
    chatWindow.innerHTML += `
      <div class="message error">
        Sorry, there was an error processing the product. Please try again.
      </div>
    `;
  }
});

/* Update the selected products display */
function updateSelectedProductsList() {
  selectedProductsList.innerHTML = selectedProducts
    .map(product => `
      <div class="selected-product">
        <span>${product.name}</span>
        <button class="remove-product" data-name="${product.name}">
          <i class="fa-solid fa-times"></i>
        </button>
      </div>
    `)
    .join("");
}

/* Remove product from selection */
selectedProductsList.addEventListener("click", (e) => {
  if (e.target.closest(".remove-product")) {
    const productName = e.target.closest(".remove-product").dataset.name;
    selectedProducts = selectedProducts.filter(p => p.name !== productName);
    updateSelectedProductsList();
    
    // Update product card selection state
    const productCard = document.querySelector(`[data-product*="\\"name\\":\\"\${productName}\\""]`);
    if (productCard) {
      productCard.classList.remove("selected");
    }
    
    // Save updated products list
    saveSelectedProducts();
  }
});

async function generateRoutine() {
  let messageElement = null;
  
  try {
    if (selectedProducts.length === 0) {
      chatWindow.innerHTML += `
        <div class="message error">
          Please select at least one product first.
        </div>
      `;
      return;
    }

    // Show loading state
    generateRoutineBtn.disabled = true;
    generateRoutineBtn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Generating...';

    // Create a simple routine request (Worker will handle system prompt)
    const routineMessages = [
      {
        role: "user",
        content: `Create a routine using these products: ${selectedProducts.map(p => p.name).join(", ")}. Include the order of use, time of day, and application tips.`
      }
    ];

    // Create message container
    const messageId = Date.now();
    chatWindow.insertAdjacentHTML('beforeend', `
      <div class="message ai-message" id="msg-${messageId}">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    messageElement = document.getElementById(`msg-${messageId}`);

    // Make API request using the same endpoint as chat
    const response = await fetch('https://chill-worker.mikkaeldumancas.workers.dev/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ messages: routineMessages })
    });

    if (!response.ok) {
      throw new Error('Failed to generate routine');
    }

    // Process response
    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Invalid response format');
    }

    // Update message content
    messageElement.innerHTML = marked.parse(`**Your Personalized Routine:**\n\n${content}`);
    chatWindow.scrollTop = chatWindow.scrollHeight;

  } catch (error) {
    console.error('Error generating routine:', error);
    
    if (messageElement) {
      messageElement.innerHTML = marked.parse('**Error:**\n\nSorry, there was an error generating your routine.');
    } else {
      chatWindow.innerHTML += `
        <div class="message error">
          Sorry, there was an error generating your routine. Please try again.
        </div>
      `;
    }
  } finally {
    // Reset button state
    generateRoutineBtn.disabled = false;
    generateRoutineBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
}

// Add click event listener
generateRoutineBtn.addEventListener("click", generateRoutine);
/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const userInput = e.target.userInput.value.trim();
  if (!userInput) return;

  let messageElement = null;

  try {
    // Create a container for the user message
    const userMessageId = `user-${Date.now()}`;
    chatWindow.insertAdjacentHTML('beforeend', `
      <div class="message user-message" id="${userMessageId}">
        ${marked.parse(userInput)}
      </div>
    `);

    // Clear input and scroll to show the new message
    e.target.userInput.value = "";
    chatWindow.scrollTop = chatWindow.scrollHeight;

    // Create AI message container
    const messageId = Date.now();
    chatWindow.insertAdjacentHTML('beforeend', `
      <div class="message ai-message" id="msg-${messageId}">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `);
    chatWindow.scrollTop = chatWindow.scrollHeight;
    messageElement = document.getElementById(`msg-${messageId}`);

    // Add user's message to conversation history
    conversationHistory.push({
      role: "user",
      content: userInput
    });

    // Send full conversation history to Worker (Worker handles system prompt)
    const response = await fetch('https://chill-worker.mikkaeldumancas.workers.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages: conversationHistory })
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content;
    
    if (!content) {
      throw new Error('Invalid response format');
    }

    // Add assistant's response to conversation history
    conversationHistory.push({
      role: "assistant",
      content: content
    });

    // Limit conversation history to last 10 messages (Worker adds system prompt)
    if (conversationHistory.length > 10) {
      conversationHistory = conversationHistory.slice(-10);
    }

    if (messageElement) {
      messageElement.innerHTML = marked.parse(content);
      
      // Remove typing indicator if it exists
      const typingIndicator = messageElement.querySelector('.typing-indicator');
      if (typingIndicator) {
        typingIndicator.remove();
      }
      
      chatWindow.scrollTop = chatWindow.scrollHeight;
    }

  } catch (error) {
    console.error('Error in chat:', error);
    if (messageElement) {
      messageElement.innerHTML = marked.parse('**Error:**\n\nSorry, I could not process your message.');
    } else {
      chatWindow.innerHTML += `
        <div class="message error">
          Sorry, I couldn't process your message. Please try again.
        </div>
      `;
    }
  }

  chatWindow.scrollTop = chatWindow.scrollHeight;
});
