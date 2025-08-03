/* Get references to DOM elements */
const categoryFilter = document.getElementById("categoryFilter");
const productsContainer = document.getElementById("productsContainer");
const chatForm = document.getElementById("chatForm");
const chatWindow = document.getElementById("chatWindow");
const generateRoutineBtn = document.getElementById("generateRoutine");
const selectedProductsList = document.getElementById("selectedProductsList");

// Store selected products
let selectedProducts = [];

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
      (product) => `
    <div class="product-card ${selectedProducts.some(p => p.name === product.name) ? 'selected' : ''}" 
         data-product='${JSON.stringify(product)}'>
      <img src="${product.image}" alt="${product.name}">
      <div class="product-info">
        <h3>${product.name}</h3>
        <p>${product.brand}</p>
      </div>
    </div>
  `
    )
    .join("");
}

/* Filter and display products when category changes */
categoryFilter.addEventListener("change", async (e) => {
  const products = await loadProducts();
  const selectedCategory = e.target.value;

  /* filter() creates a new array containing only products 
     where the category matches what the user selected */
  const filteredProducts = products.filter(
    (product) => product.category === selectedCategory
  );

  displayProducts(filteredProducts);
});

/* Handle product selection */
productsContainer.addEventListener("click", (e) => {
  const productCard = e.target.closest(".product-card");
  if (!productCard) return;

  const productData = JSON.parse(productCard.dataset.product);
  
  // Toggle selection
  const index = selectedProducts.findIndex(p => p.name === productData.name);
  if (index === -1) {
    selectedProducts.push(productData);
    productCard.classList.add("selected");
  } else {
    selectedProducts.splice(index, 1);
    productCard.classList.remove("selected");
  }

  // Update selected products list
  updateSelectedProductsList();
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
  }
});

/* Generate routine using OpenAI API via Cloudflare Worker */
generateRoutineBtn.addEventListener("click", async () => {
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

  try {
    const messages = [
      {
        role: "system",
        content: "You are a knowledgeable beauty advisor who creates personalized routines using L'Oréal products."
      },
      {
        role: "user",
        content: `Create a detailed routine using these products: ${selectedProducts.map(p => p.name).join(", ")}. 
                 Include the order of use, time of day, and any specific application tips.`
      }
    ];

    // Replace with your Cloudflare Worker URL
    const response = await fetch('https://chill-worker.mikkaeldumancas.workers.dev/', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      throw new Error('Failed to generate routine');
    }

    const data = await response.json();
    const routine = data.choices[0].message.content;

    // Display the routine
    chatWindow.innerHTML += `
      <div class="message">
        <strong>Your Personalized Routine:</strong><br>
        ${routine.replace(/\\n/g, '<br>')}
      </div>
    `;
    
    // Scroll to the bottom of chat window
    chatWindow.scrollTop = chatWindow.scrollHeight;

  } catch (error) {
    chatWindow.innerHTML += `
      <div class="message error">
        Sorry, there was an error generating your routine. Please try again.
      </div>
    `;
  } finally {
    // Reset button state
    generateRoutineBtn.disabled = false;
    generateRoutineBtn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Generate Routine';
  }
});

/* Chat form submission handler */
chatForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  const userInput = e.target.userInput.value.trim();
  if (!userInput) return;

  // Display user message
  chatWindow.innerHTML += `
    <div class="message user-message">
      ${userInput}
    </div>
  `;

  // Clear input
  e.target.userInput.value = "";

  try {
    // Create a unique message ID for this conversation
    const messageId = Date.now();
    
    // Add loading indicator
    chatWindow.innerHTML += `
      <div class="message ai-message" id="msg-${messageId}">
        <div class="typing-indicator">
          <span></span><span></span><span></span>
        </div>
      </div>
    `;
    chatWindow.scrollTop = chatWindow.scrollHeight;

    const messages = [
      {
        role: "system",
        content: "You are a knowledgeable beauty advisor who helps customers with L'Oréal products. Be concise but informative."
      },
      {
        role: "user",
        content: userInput
      }
    ];

    // Start the response stream
    const response = await fetch('YOUR_CLOUDFLARE_WORKER_URL', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ messages })
    });

    if (!response.ok) {
      throw new Error('Failed to get response');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let responseText = '';

    // Get the message element
    const messageElement = document.getElementById(`msg-${messageId}`);

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      
      // Decode and parse the chunk
      const chunk = decoder.decode(value);
      const lines = chunk.split('\n').filter(line => line.trim() !== '');
      
      for (const line of lines) {
        if (line.startsWith('data: ')) {
          const data = JSON.parse(line.slice(6));
          if (data.choices[0].delta.content) {
            responseText += data.choices[0].delta.content;
            // Update the message content, maintaining HTML formatting
            messageElement.innerHTML = responseText.replace(/\\n/g, '<br>');
          }
        }
      }
    }

    // Remove typing indicator if it still exists
    const typingIndicator = messageElement.querySelector('.typing-indicator');
    if (typingIndicator) {
      typingIndicator.remove();
    }

  } catch (error) {
    chatWindow.innerHTML += `
      <div class="message error">
        Sorry, I couldn't process your message. Please try again.
      </div>
    `;
  }

  // Scroll to the bottom of chat window
  chatWindow.scrollTop = chatWindow.scrollHeight;
});
